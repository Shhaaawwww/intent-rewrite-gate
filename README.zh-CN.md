# Vibe Intent Compiler

[English](README.md)

一个即插即用的 DeepSeek Harness 插件：把 Vibe Coder 的混乱草稿整理成简洁、忠实、可执行的指令，并且不擅自增加细节。

它不是通用的“提示词增强器”。插件只读取 DeepSeek Harness 输入框中尚未发送的完整草稿，仅重新组织用户已经表达的内容，然后原位回填。是否继续修改、是否发送，始终由用户决定。

## 安装

需要 DeepSeek Harness `0.1.1-rc.2` 或更高版本，并已在 Harness 中配置默认模型。

```bash
npm install -g @deepseek-ai/dsh
dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.3.0"
dsh web
```

安装后重启 Web UI，输入框发送按钮旁会出现 `✦ 编译意图`。

如果通过 `npx` 使用 Harness：

```bash
npx @deepseek-ai/dsh plugin --profile web add "github:Shhaaawwww/vibe-intent-compiler#v0.3.0"
npx @deepseek-ai/dsh web
```

## 使用

1. 在输入框中写下自然、零散或反复修正的需求。
2. 点击 `✦ 编译意图`。
3. 检查回填结果，按需继续编辑，然后自行发送。

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
- 不添加项目事实、文件、框架、实现细节、步骤、测试、验收标准、功能或权限。
- 短输入保持短；正常结果限制在有效原文长度的约两倍以内。
- 不执行任务，也不会自动发送消息。

## 边界与隐私

- 0.2 版本处理完整草稿，不支持只改写当前选区。
- 不监听双击空格，避免与输入法、代码和 Markdown 冲突。
- 使用 Harness 已配置的默认模型，不额外保存 API Key。
- 改写期间如果用户继续输入，旧结果会被丢弃，不会覆盖新内容。
- 原始草稿不会写入命令输入日志；改写结果会作为命令结果保留在 Harness 会话记录中。
- 超过 20,000 个字符的草稿不会被静默截断，而是保持原文不变。

## 本地安装

```bash
dsh plugin --profile web add /absolute/path/to/vibe-intent-compiler
dsh web
```

仓库已经提交可直接加载的构建产物，安装时不会运行构建脚本。

## 开源协议

MIT，详见 [LICENSE](LICENSE)。
