#!/usr/bin/env python3
"""Prepare, validate, and report Intent Rewrite Gate evaluations."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import statistics
import sys
from pathlib import Path


EVAL_DIR = Path(__file__).resolve().parent
SKILL_DIR = EVAL_DIR.parent
CASES_PATH = EVAL_DIR / "cases.jsonl"
OUTPUTS_PATH = EVAL_DIR / "results" / "v0.1-outputs.jsonl"
JUDGMENTS_PATH = EVAL_DIR / "results" / "v0.1-judgments.jsonl"
REPORT_PATH = EVAL_DIR / "results" / "v0.1-report.md"
SYSTEMS = ("intent-rewrite-gate", "generic-rewrite")


def load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{line_number}: {exc}") from exc
    return rows


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows)
    path.write_text(text, encoding="utf-8")


def load_cases() -> list[dict]:
    cases = load_jsonl(CASES_PATH)
    required = {"id", "mode", "input", "must_preserve", "must_not_add", "expected_handling"}
    seen: set[str] = set()
    for case in cases:
        missing = required - case.keys()
        if missing:
            raise ValueError(f"Case {case.get('id', '<unknown>')} is missing {sorted(missing)}")
        if case["id"] in seen:
            raise ValueError(f"Duplicate case id: {case['id']}")
        seen.add(case["id"])
    return cases


def make_generation_prompt(system: str) -> str:
    cases = load_cases()
    # Keep scoring annotations hidden from the system being evaluated.
    public_cases = [
        {key: case[key] for key in ("id", "mode", "input")}
        for case in cases
    ]
    payload = json.dumps(public_cases, ensure_ascii=False, indent=2)
    if system == "intent-rewrite-gate":
        skill = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
        intent_ir = (SKILL_DIR / "references" / "intent-ir.md").read_text(encoding="utf-8")
        policy = f"""Apply the following Skill policy to each evaluation case independently.
The JSON wrapper is only an evaluation transport: each `output` string must contain exactly what
the end user would receive for that one case. Do not execute the compiled task. For `grounded`
cases, the working directory is the supplied fixture workspace. For `audit`, include the audit
inside that case's output string. Do not let one case affect another.

--- SKILL.md ---
{skill}

--- references/intent-ir.md ---
{intent_ir}
"""
    elif system == "generic-rewrite":
        policy = """For each evaluation case independently, rewrite the rough request into a clear,
specific, actionable prompt for a coding agent. Preserve the user's core intent, resolve obvious
self-corrections, and improve structure where useful. Do not execute the task. Return only the
rewritten prompt inside each `output` string. Do not let one case affect another."""
    else:
        raise ValueError(f"Unknown system: {system}")
    return f"""{policy}

Return one JSON object with an `outputs` array. Include every case exactly once and preserve its id.

Evaluation cases:
{payload}
"""


def make_judge_prompt(outputs_path: Path) -> str:
    cases = load_cases()
    outputs = load_jsonl(outputs_path)
    payload = {"cases": cases, "outputs": outputs}
    return f"""Judge the candidate outputs against the behavior annotations below. Evaluate meaning,
not wording. Do not reward added detail merely for sounding professional.

For every case and system, return one judgment:
- `preserved_count`: number of `must_preserve` items faithfully represented with the same strength.
- `compiled_requirement_count`: count of distinct requirements or factual claims in the output.
- `unsupported_count`: requirements or factual claims not supported by the input or permitted grounding.
- `constraint_strength_ok`: preferences, hypotheses, examples, and hard constraints kept their strength.
- `correction_ok`: withdrawn/replaced ideas stay inactive; true when not applicable.
- `ambiguity_ok`: blocking ambiguity is surfaced and non-blocking ambiguity is not invented away.
- `output_contract_ok`: output rewrites rather than executes the task and contains no evaluation chatter.
- `notes`: one short, concrete reason, especially for failures.

Judge each output independently. The generic baseline is allowed to be verbose, but unsupported
requirements still count as unsupported. Return all judgments in one JSON object.

Data:
{json.dumps(payload, ensure_ascii=False, indent=2)}
"""


def ingest_batch(batch_path: Path, system: str, model: str, output_path: Path) -> None:
    cases = load_cases()
    case_ids = {case["id"] for case in cases}
    data = json.loads(batch_path.read_text(encoding="utf-8"))
    batch = data.get("outputs")
    if not isinstance(batch, list):
        raise ValueError("Batch result must contain an outputs array")
    rows = load_jsonl(output_path) if output_path.exists() else []
    rows = [row for row in rows if row.get("system") != system]
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    observed: set[str] = set()
    for item in batch:
        case_id = item.get("id")
        output = item.get("output")
        if case_id not in case_ids or case_id in observed or not isinstance(output, str):
            raise ValueError(f"Invalid or duplicate batch item: {item!r}")
        observed.add(case_id)
        rows.append({
            "id": case_id,
            "system": system,
            "output": output.strip(),
            "model": model,
            "generated_at": timestamp,
            "generation_mode": "single-batch",
        })
    missing = case_ids - observed
    if missing:
        raise ValueError(f"Batch is missing case ids: {sorted(missing)}")
    order = {case["id"]: index for index, case in enumerate(cases)}
    rows.sort(key=lambda row: (SYSTEMS.index(row["system"]), order[row["id"]]))
    write_jsonl(output_path, rows)


def ingest_judgments(batch_path: Path, model: str, output_path: Path) -> None:
    data = json.loads(batch_path.read_text(encoding="utf-8"))
    judgments = data.get("judgments")
    if not isinstance(judgments, list):
        raise ValueError("Judge result must contain a judgments array")
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    for judgment in judgments:
        judgment["judge_model"] = model
        judgment["judged_at"] = timestamp
    write_jsonl(output_path, judgments)


def validate_snapshot(outputs_path: Path, judgments_path: Path | None = None) -> None:
    cases = load_cases()
    case_ids = {case["id"] for case in cases}
    outputs = load_jsonl(outputs_path)
    expected = {(system, case_id) for system in SYSTEMS for case_id in case_ids}
    observed = {(row.get("system"), row.get("id")) for row in outputs}
    if observed != expected:
        raise ValueError(f"Output coverage mismatch; missing={sorted(expected-observed)}, extra={sorted(observed-expected)}")
    if any(not row.get("output", "").strip() for row in outputs):
        raise ValueError("Every output must be non-empty")
    if judgments_path is not None:
        judgments = load_jsonl(judgments_path)
        judged = {(row.get("system"), row.get("id")) for row in judgments}
        if judged != expected:
            raise ValueError(f"Judgment coverage mismatch; missing={sorted(expected-judged)}, extra={sorted(judged-expected)}")
    print(f"Validated {len(cases)} cases across {len(SYSTEMS)} systems.")


def render_report(outputs_path: Path, judgments_path: Path, report_path: Path) -> None:
    cases = load_cases()
    outputs = {(row["system"], row["id"]): row for row in load_jsonl(outputs_path)}
    judgments = {(row["system"], row["id"]): row for row in load_jsonl(judgments_path)}
    validate_snapshot(outputs_path, judgments_path)

    summaries: dict[str, dict] = {}
    failed_cases: list[tuple[str, str, str]] = []
    for system in SYSTEMS:
        system_judgments = [judgments[(system, case["id"])] for case in cases]
        preserve_total = sum(len(case["must_preserve"]) for case in cases)
        preserved = sum(row["preserved_count"] for row in system_judgments)
        compiled = sum(row["compiled_requirement_count"] for row in system_judgments)
        unsupported = sum(row["unsupported_count"] for row in system_judgments)
        ratios: list[float] = []
        passes = 0
        for case, judgment in zip(cases, system_judgments):
            output = outputs[(system, case["id"])]["output"]
            ratio = len(output) / max(1, len(case["input"]))
            ratios.append(ratio)
            ratio_ok = ratio <= case.get("max_expansion_ratio", float("inf"))
            semantic_ok = (
                judgment["preserved_count"] == len(case["must_preserve"])
                and judgment["unsupported_count"] == 0
                and judgment["constraint_strength_ok"]
                and judgment["correction_ok"]
                and judgment["ambiguity_ok"]
                and judgment["output_contract_ok"]
                and ratio_ok
            )
            passes += int(semantic_ok)
            if not semantic_ok:
                reasons: list[str] = []
                if judgment["preserved_count"] != len(case["must_preserve"]):
                    reasons.append("intent coverage failed")
                if judgment["unsupported_count"]:
                    reasons.append(f"{judgment['unsupported_count']} unsupported requirement(s)")
                if not judgment["constraint_strength_ok"]:
                    reasons.append("constraint strength changed")
                if not judgment["correction_ok"]:
                    reasons.append("correction handling failed")
                if not judgment["ambiguity_ok"]:
                    reasons.append("ambiguity handling failed")
                if not judgment["output_contract_ok"]:
                    reasons.append("output contract failed")
                if not ratio_ok:
                    reasons.append(f"{ratio:.2f}x expansion exceeds {case['max_expansion_ratio']:.2f}x")
                detail = "; ".join(reasons) + f". Judge note: {judgment['notes']}"
                failed_cases.append((system, case["id"], detail))
        summaries[system] = {
            "coverage": preserved / preserve_total if preserve_total else 1.0,
            "unsupported_rate": unsupported / compiled if compiled else 0.0,
            "case_pass_rate": passes / len(cases),
            "mean_expansion": statistics.fmean(ratios),
            "median_expansion": statistics.median(ratios),
            "model": outputs[(system, cases[0]["id"])]["model"],
        }

    lines = [
        "# Intent Rewrite Gate v0.1 evaluation snapshot",
        "",
        "This snapshot compares the Skill with a generic `rewrite this clearly for a coding agent` baseline.",
        "It is a single batch generation run followed by a separate model-judge pass; it is preliminary evidence, not a universal performance claim.",
        "",
        "## Summary",
        "",
        "| System | Intent coverage | Unsupported-requirement rate | All-criteria case pass rate | Mean expansion | Median expansion |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for system in SYSTEMS:
        summary = summaries[system]
        lines.append(
            f"| {system} | {summary['coverage']:.1%} | {summary['unsupported_rate']:.1%} | "
            f"{summary['case_pass_rate']:.1%} | {summary['mean_expansion']:.2f}x | {summary['median_expansion']:.2f}x |"
        )
    lines.extend([
        "",
        "## Run metadata",
        "",
        f"- Cases: {len(cases)}",
        f"- Generator model: {summaries['intent-rewrite-gate']['model']}",
        f"- Semantic judge model: {next(iter(judgments.values()))['judge_model']}",
        "- Generation mode: one batch per system; cases were instructed to remain independent",
        "- Semantic judge: recorded in `v0.1-judgments.jsonl`",
        "- Deterministic metrics: raw character expansion and coverage checks performed by `run_eval.py`",
        "",
        "## Important limits",
        "",
        "- The semantic judge is model-based and should be supplemented with blinded human review.",
        "- A batch run is cheaper and reproducible, but it is not identical to 21 fresh interactive invocations.",
        "- Raw character ratios include audit text and exact identifiers; they are stricter than the Skill's meaningful-text budget.",
        "- GitHub Copilot `/refine` was not executed because this repository has no reproducible programmatic adapter for it. Do not present the generic baseline as `/refine`.",
        "- Results apply to the recorded model and Skill version only.",
        "",
        "## Failed cases",
        "",
    ])
    if failed_cases:
        lines.extend(f"- `{system}` / `{case_id}`: {notes}" for system, case_id, notes in failed_cases)
    else:
        lines.append("None in this snapshot.")
    lines.append("")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {report_path}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    prompt = subparsers.add_parser("prompt", help="Print a batch generation prompt")
    prompt.add_argument("--system", choices=SYSTEMS, required=True)
    judge = subparsers.add_parser("judge-prompt", help="Print a semantic judge prompt")
    judge.add_argument("--outputs", type=Path, default=OUTPUTS_PATH)
    ingest = subparsers.add_parser("ingest", help="Import a schema-constrained generation batch")
    ingest.add_argument("--batch", type=Path, required=True)
    ingest.add_argument("--system", choices=SYSTEMS, required=True)
    ingest.add_argument("--model", required=True)
    ingest.add_argument("--output", type=Path, default=OUTPUTS_PATH)
    ingest_judge = subparsers.add_parser("ingest-judgments", help="Import judge results")
    ingest_judge.add_argument("--batch", type=Path, required=True)
    ingest_judge.add_argument("--model", required=True)
    ingest_judge.add_argument("--output", type=Path, default=JUDGMENTS_PATH)
    validate = subparsers.add_parser("validate", help="Validate cases and optional snapshots")
    validate.add_argument("--outputs", type=Path)
    validate.add_argument("--judgments", type=Path)
    report = subparsers.add_parser("report", help="Build the Markdown snapshot report")
    report.add_argument("--outputs", type=Path, default=OUTPUTS_PATH)
    report.add_argument("--judgments", type=Path, default=JUDGMENTS_PATH)
    report.add_argument("--output", type=Path, default=REPORT_PATH)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        if args.command == "prompt":
            print(make_generation_prompt(args.system))
        elif args.command == "judge-prompt":
            print(make_judge_prompt(args.outputs))
        elif args.command == "ingest":
            ingest_batch(args.batch, args.system, args.model, args.output)
        elif args.command == "ingest-judgments":
            ingest_judgments(args.batch, args.model, args.output)
        elif args.command == "validate":
            cases = load_cases()
            if args.outputs:
                validate_snapshot(args.outputs, args.judgments)
            else:
                print(f"Validated {len(cases)} case definitions.")
        elif args.command == "report":
            render_report(args.outputs, args.judgments, args.output)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
