# AI 娘 Q 版參考圖來源

- **來源**：[AI-Fanworks](https://github.com/Apprentice-Geo/AI-Fanworks) 的 `ApprenTice/AI-Girls-and-Chibis`（2026-11-01 下載 `*-Chibi.png`、`Chibis.png`、`README.md`、`Prompts.md`）
- **作者**：[ApprenTice](https://space.bilibili.com/634972797)
- **原作**：[ZipZipPipe《大 AI 與小 AI 們》](https://www.bilibili.com/video/BV1tE9XBbErS/)，原作聲明「依 CC BY-NC-SA 4.0 非商業使用，二創同協議授權」
- **DeepSeek 鯨魚娘**：上善無形原創角色，ZipZipPipe 二次設計
- **授權**：
  - 圖像：CC BY-NC-SA 4.0。轉載要保留署名、來源與授權，二創須用同一授權。
  - `Prompts.md` 的提示詞文字：作者聲明可自由使用，包括商用，不必署名。

## 本專案怎麼用

在 ChatGPT「製作圖像」上傳各角色的 `*-Chibi.png`，指示如下：

> 請把附圖的角色原封不動保留（造型、髮型、配色、表情、姿勢、手上的道具和飾品都不要改），只把背景換成純白色 #FFFFFF：拿掉背景的漸層、圖案、裝飾和地面陰影，不要文字、不要邊框。直式 2:3，角色全身完整入框、置中，四周留一點白邊。

- 輸出存成 `art/raw/char_{gpt,claude,gemini,grok,kimi,qwen,glm}.png`。
- 用 `tools/cutout.py` 去背、`tools/avatars.py` 裁頭像後放進遊戲。
- GLM 用的是小狐娘版（`GLM-Fox-Chibi.png`）。

這些改作同樣以 CC BY-NC-SA 4.0 分享，只用於本作的非商用版本，出處寫在遊戲內「致謝與授權」。

角色都是粉絲二次創作的虛構擬人角色，與各 AI 產品官方、運營主體及相關公司沒有任何關聯。
