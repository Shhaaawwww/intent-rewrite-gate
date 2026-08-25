# Intent Rewrite Gate for DeepSeek Harness

把 Vibe Coder 的混乱表达整理成简洁、忠实、可执行的意图，并且不擅自增加细节。

它不是通用“提示词润色器”。插件只做一件事：读取 DeepSeek Harness 输入框里的完整草稿，保守整理后原位回填；是否继续修改、是否发送，始终由用户决定。

## 安装

需要 DeepSeek Harness `0.1.1-rc.2` 或更高版本，并已在 Harness 中配置好默认模型。

```bash
npm install -g @deepseek-ai/dsh
dsh plugin --profile web add "github:Shhaaawwww/intent-rewrite-gate#v0.2.0"
dsh web
```

安装后重启 Web UI，输入框发送按钮旁会出现 `✦ 整理意图`。

如果只通过 `npx` 使用 Harness：

```bash
npx @deepseek-ai/dsh plugin --profile web add "github:Shhaaawwww/intent-rewrite-gate#v0.2.0"
npx @deepseek-ai/dsh web
```

## 使用

1. 在输入框中写下自然、零散或反复修正的需求。
2. 点击 `✦ 整理意图`。
3. 检查回填结果，按需继续编辑，然后自行发送。

示例：

```text
输入：登录最近老出问题，可能是 token，界面也改好看点，算了界面先别动。
回填：修复最近频繁出现的登录问题；将 token 作为待验证的可能原因，不要修改界面。
```

## 产品原则

- 只使用草稿中明确存在的信息。
- 后面的修正只覆盖与其冲突的旧表述，删除已撤回的想法。
- 保留事实、限制、禁止项、偏好和待验证猜测之间的区别。
- 原样保留代码、命令、路径、URL、错误信息、标识符和技术术语。
- 不添加项目事实、实现细节、文件、框架、步骤、测试或验收标准。
- 短输入保持短；正常结果不会超过有效原文的约两倍。
- 不执行任务，不自动发送。

## 设计边界

- 首版处理完整草稿，不支持只改写当前选区。
- 不监听双击空格，避免与中文输入法、代码和 Markdown 冲突。
- 使用 Harness 已配置的默认模型，不额外保存 API Key。
- 改写期间如果用户继续输入，旧结果会被丢弃，不覆盖新内容。
- 原始草稿不会写入命令日志；改写结果会作为命令完成结果保留在 Harness 会话记录中。
- 超过 20,000 个字符的草稿不会被静默截断，而是保持原文不变。

## 本地安装

```bash
dsh plugin --profile web add /absolute/path/to/intent-rewrite-gate
dsh web
```

插件提交了可直接加载的构建产物，安装时不运行构建脚本。

## License

MIT. See [LICENSE](LICENSE).
