window.__ModuleLoader__.load({
	id: "dsh-vibe-intent-compiler",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region src/client/index.js
		/** DeepSeek Harness browser half for Vibe Intent Compiler. */
		const name = "vibe-intent-compiler";
		const inject = [
			"slots",
			"remote",
			"remote.commands",
			"locale"
		];
		const ID = "dsh-vibe-intent-compiler";
		const COMMAND_NAME = "compile-intent";
		const MAX_DRAFT_LENGTH = 2e4;
		const CSS = `
.vic-button { display: inline-flex; align-items: center; gap: 5px; height: 24px;
  border: 1px solid rgba(127,127,127,.35); background: transparent; color: inherit;
  border-radius: 999px; padding: 0 9px; font: inherit; font-size: 12px; line-height: 1;
  cursor: pointer; opacity: .8; white-space: nowrap; }
.vic-button:hover:not(:disabled) { opacity: 1; background: rgba(127,127,127,.12); }
.vic-button:disabled { cursor: default; opacity: .4; }
.vic-spinner { width: 11px; height: 11px; border: 1.5px solid currentColor;
  border-right-color: transparent; border-radius: 50%; animation: vic-spin .8s linear infinite; }
@keyframes vic-spin { to { transform: rotate(360deg); } }
`;
		const ZH = {
			"button.idle": "编译意图",
			"button.busy": "编译中…",
			"button.error": "重试编译",
			"button.stale": "未覆盖新内容",
			"button.long": "草稿过长",
			"title.idle": "编译为简洁、忠实、可执行的意图；不会自动发送",
			"title.busy": "正在编译意图…",
			"title.error": "编译失败，原草稿未更改；点击重试",
			"title.stale": "检测到你继续编辑，因此没有覆盖新内容",
			"title.long": "草稿超过 20,000 个字符，插件不会截断处理"
		};
		const EN = {
			"button.idle": "Compile intent",
			"button.busy": "Compiling…",
			"button.error": "Retry",
			"button.stale": "New edits kept",
			"button.long": "Draft too long",
			"title.idle": "Compile the draft into a concise, faithful, executable intent; never auto-send",
			"title.busy": "Compiling intent…",
			"title.error": "Compilation failed and the draft was left unchanged; click to retry",
			"title.stale": "You edited the draft while compiling, so the newer text was kept",
			"title.long": "Drafts over 20,000 characters are never silently truncated"
		};
		function installStyle() {
			if (typeof document === "undefined") return;
			const selector = `style[data-plugin-css="${ID}"]`;
			if (document.querySelector(selector) !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = ID;
			tag.dataset.pluginCss = ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}
		function apply(ctx) {
			installStyle();
			ctx.effect(() => ctx.locale.register(ID, {
				zh: ZH,
				en: EN
			}), "vibe-intent-compiler: locale");
			const t = ctx.locale.bind(ID);
			function VibeIntentCompilerButton(props) {
				const input = props.useInput((state) => state);
				const inputActions = props.inputActions;
				const sessionId = props.sessionId ? String(props.sessionId) : "";
				const [status, setStatus] = (0, react.useState)("idle");
				const [, refreshLocale] = (0, react.useState)(0);
				const inputRef = (0, react.useRef)(input);
				const requestRef = (0, react.useRef)(null);
				const mountedRef = (0, react.useRef)(true);
				inputRef.current = input;
				(0, react.useEffect)(() => ctx.locale.subscribe(() => refreshLocale((value) => value + 1)), []);
				(0, react.useEffect)(() => () => {
					mountedRef.current = false;
					requestRef.current?.abort();
				}, []);
				const draft = typeof input.draft === "string" ? input.draft : "";
				const isBusy = status === "busy";
				const isLong = draft.length > MAX_DRAFT_LENGTH;
				const disabled = isBusy || draft.trim().length === 0 || sessionId === "" || isLong;
				const labelKey = isLong ? "button.long" : `button.${status}`;
				const titleKey = isLong ? "title.long" : `title.${status}`;
				const compileDraft = async () => {
					if (disabled) return;
					const source = draft;
					const revision = input.draftRev;
					const controller = new AbortController();
					requestRef.current = controller;
					setStatus("busy");
					try {
						const response = await ctx.remote.commands.execute(sessionId, `/${COMMAND_NAME} ${source}`, [], controller.signal);
						const result = response?.ok ? response.value?.result : void 0;
						if (result?.kind !== "success" || typeof result.text !== "string" || result.text.trim().length === 0) throw new Error("intent compilation command failed");
						const current = inputRef.current;
						if (current?.draftRev !== revision || current?.draft !== source) {
							if (mountedRef.current) setStatus("stale");
							return;
						}
						inputActions.setDraft(result.text);
						if (mountedRef.current) setStatus("idle");
					} catch (error) {
						if (!controller.signal.aborted && mountedRef.current) {
							console.error("vibe-intent-compiler: compilation failed; draft left unchanged");
							setStatus("error");
						}
					} finally {
						if (requestRef.current === controller) requestRef.current = null;
					}
				};
				return (0, react.createElement)("button", {
					type: "button",
					className: "vic-button",
					disabled,
					onClick: compileDraft,
					title: t(titleKey),
					"aria-label": t(titleKey),
					"aria-live": "polite"
				}, isBusy ? (0, react.createElement)("span", {
					className: "vic-spinner",
					"aria-hidden": "true"
				}) : (0, react.createElement)("span", { "aria-hidden": "true" }, "✦"), (0, react.createElement)("span", null, t(labelKey)));
			}
			ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
				name: "conversation.input.right",
				id: "vibe-intent-compiler",
				order: 100,
				label: "Compile intent"
			}, (props) => (0, react.createElement)(VibeIntentCompilerButton, props)));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
