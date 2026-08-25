# Vibe Intent Compiler

[English](README.md)

一个即插即用的 DeepSeek Harness 插件：把 Vibe Coder 的混乱草稿整理成简洁、忠实、可执行的指令，并且不擅自增加细节。

它不是通用的“提示词增强器”。插件读取 DeepSeek Harness 输入框中尚未发送的完整草稿，仅重新组织用户已经表达的内容，然后原位回填。只有当用户明确选择了 `@file` 时，插件才会用该文件消解草稿中已经存在的指代。是否继续修改、是否发送，始终由用户决定。

0.4 是 **Faithful Context Beta（保真上下文测试版）**：模型重写前后都有确定性检查。无法确认结果安全、忠实时，原草稿保持不变。

## 安装

安装前需要：

- Node.js `22.19.x` 或 `24+`（`^22.19.0 || >=24.0.0`）。
- DeepSeek Harness `0.1.1-rc.2` 或更高版本。
- `pnpm` 已安装并可通过 `PATH` 调用。即使 Harness 本身通过 `npm` 安装或通过 `npx` 启动，它仍使用 `pnpm` 管理 Profile 插件。
- 已在 Harness 中配置默认模型。

```bash
npm install -g @deepseek-ai/dsh pnpm
pnpm --version
dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.4.0"
dsh web
```

插件安装命令必须成功完成后再启动 Web UI。创建或进入一个对话，`✦ Clarify` 会显示在对话输入框中，不会显示在首页。

如果通过 `npx` 使用 Harness：

```bash
npm install -g pnpm
npx @deepseek-ai/dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.4.0"
npx @deepseek-ai/dsh web
```

### 安装问题排查

如果 Harness 显示 `pnpm not found on PATH`，说明插件尚未安装。先关闭 Web UI，然后执行：

```bash
npm install -g pnpm
pnpm --version
dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.4.0"
dsh web
```

如果安装最终显示 `Done`，`node-domexception` 弃用提示或 peer dependency 警告不会阻止插件安装。如果仍未看到按钮，请重启 `dsh web`、进入一个对话并强制刷新页面。

## 使用

1. 在输入框中写下自然、零散或反复修正的需求。
2. 如需项目上下文，输入 `@` 并从 Harness 列表中选择最多三个文件。只有被选中的文件芯片会被读取；普通路径和手动输入的 `@文字` 不会被读取。
3. 点击 `✦ Clarify`，按钮会显示本次将使用多少个文件。
4. 检查回填结果，按需继续编辑，然后自行发送。

示例：

```text
整理前：登录最近老出问题，可能是 token，界面也改好看点，算了界面先别动。

整理后：修复最近频繁出现的登录问题；将 token 作为待验证的可能原因，不要修改界面。
```

## 核心差异

- 只使用草稿中明确存在的信息。
- 后面的修正只在发生冲突时替换旧表述。
- 删除已撤回的想法，同时保留限制、偏好和不确定性。
- 原样保留代码、命令、路径、URL、错误信息、标识符、Schema 字段和技术术语。
- 重写后验证受保护文本；遗漏关键字面量或新增 `@引用` 时拒绝覆盖。
- 不添加项目事实、文件、框架、实现细节、步骤、测试、验收标准、功能或权限。
- 可以用明确选择的文件消解已有指代或确认现有标识符，但不会搜索项目、追踪 import，也不会启动 Agent 工具循环。
- 短输入保持短；正常结果限制在有效原文长度的约两倍以内。
- 不执行任务，也不会自动发送消息。

## 边界与隐私

- 0.4 版本处理完整草稿，不支持只改写当前选区。
- 不监听双击空格，避免与输入法、代码和 Markdown 冲突。
- 使用 Harness 已配置的默认 Provider 和模型，不额外保存 API Key；改写请求明确使用 `low` reasoning，不继承主对话的 reasoning effort。
- 文件上下文是确定性预处理，不是 Agent：只读取 Harness 输入框记录的有效文件芯片。插件会校验芯片的结构化偏移，因此中文贴写和标点旁的引用可以正常工作，手动输入的 `@文字` 不会被当成已选文件。
- 目录、二进制或非 UTF-8 文件、越出 workspace 的路径及符号链接逃逸都会被拒绝。
- 默认拦截 `.env`、凭据/secret 文件、SSH/AWS/Git 元数据和私钥格式；草稿和选中文件的文本还会在发送给模型前检查常见凭据特征。
- 最多读取三个文件，单个不超过 24 KiB、合计不超过 48 KiB。插件不会静默截断文件；引用不合规时保持原草稿不变。
- 被选择的文件内容会和草稿一起发送给同一个已配置模型 Provider。插件不会额外持久化副本，但仍需遵守该 Provider 自身的数据保留政策。
- 敏感内容检测是保守的尽力防护，不是密码管理器；不要选择任何可能包含凭据或私人数据的文件。
- 结果必须保留选中的引用及可检测的代码、命令、URL、路径和标识符，不得新增 `@引用` 或复制较长的文件原文；验证失败时保持草稿不变。
- 改写期间如果用户继续输入，旧结果会被丢弃，不会覆盖新内容。
- 原始草稿不会写入命令输入日志；改写结果会作为命令结果保留在 Harness 会话记录中。
- 超过 20,000 个字符的草稿不会被静默截断，而是保持原文不变。

## 本地安装

```bash
dsh plugin --profile web add /absolute/path/to/vibe-intent-compiler
dsh web
```

仓库已经提交可直接加载的构建产物，安装时不会运行构建脚本。

漏洞报告方式和安全边界见 [SECURITY.md](SECURITY.md)。

## 开源协议

MIT，详见 [LICENSE](LICENSE)。
