# LOVE.EXE — Step-by-Step Guide ตั้งแต่เริ่มต้น

---

## Step 0: เข้าใจโปรเจคก่อน

โปรเจคพวกเธอ **LOVE.EXE** คือ:
- เกม Web-based แนว **Pixel RPG + Mini-game collection**
- Engine: **Cocos Creator** (เหมือน final-pleng ของเพื่อน)
- Style: **8-16 bit pixel art** แบบ Stardew Valley / Harvest Moon
- Map: **NTHU campus** (Delta Building เป็นฉาก)
- Story: นักศึกษา ECCS จีบสาว ผ่าน mini-games ต่างๆ

---

## Step 1: ติดตั้ง Tools ที่ต้องใช้

| Tool | ทำไม |
|------|-------|
| **Cocos Creator 2.4.x** | Engine เดียวกับ final-pleng ของเพื่อน |
| **VS Code** | เขียน TypeScript |
| **Tiled Map Editor** | สร้าง map (เพื่อนใช้ .tmx files) |
| **Aseprite** (หรือ LibreSprite ฟรี) | วาด pixel art sprites |
| **Firebase CLI** | สำหรับ leaderboard + deploy |
| **Git + GitLab** | version control (มีอยู่แล้ว) |

---

## Step 2: Request Assets จาก TA (ด่วน! deadline 5/26 23:59)

### ต้องขอ (Core — ขาดไม่ได้)

| เลขที่ | ชื่อ | เหตุผล |
|--------|------|--------|
| 77 | 2D Pixel Fire Hero | ตัวละคร protagonist style |
| 78 | 2D Pixel Ice Hero 2 | ตัวละครเพิ่มเติม |
| 80 | 2D Pixel - RPG Monster Pack | สัตว์ร้าย/อุปสรรค (เช่น หมา) |
| 81 | 2D Black & White Environments | ฉากหลัง campus |
| 85 | 2D Magic Lands SET2 | ฉาก overworld |
| 87 | 2D Magic Lands SET3 | ฉาก overworld เพิ่ม |
| 91 | 2D Platformer Level Kit | โครงสร้าง level |
| 94 | 2D Sci-Fi Environment Pack | ฉากห้องเรียน/lab |
| 92 | Simple Fantasy UI | UI สำหรับ dialogue/menu |
| 69 | Ultimate Game UI | UI หลักของเกม |

### ควรขอ (Enhancement)

| เลขที่ | ชื่อ | เหตุผล |
|--------|------|--------|
| 22 | Emotional Main Theme Music Pack | BGM หลัก — โรแมนติก เหมาะมาก |
| 62 | RPG & Dungeon Sounds | เสียง SFX |
| 93 | Casual Game Music | เพลง mini-game |
| 96 | Gun & Explosion Sounds | เสียง action mini-game |
| 1 | 2.5D Isometric engine | ถ้าอยากได้ isometric map |
| 7 | 2D Platformer Tileset | Tileset สำหรับ map NTHU |
| 21 | Dynamic Fog & Mist | visual effect เก๋ |

### Optional (ถ้า quota เหลือ)

| เลขที่ | ชื่อ | เหตุผล |
|--------|------|--------|
| 70 | Unique Toon Projectiles Vol. 1 | สำหรับ mini-game ยิงกัน |
| 44 | Mesh Effects | particle effects |
| 4 | 2D Magic & Attack Effects | effect ตอน battle |
| 102 | 2D Explosion Fire Smoke | explosion effect |

---

## Step 3: Setup โปรเจค Cocos Creator

```
1. Download Cocos Creator 2.4.8 (เวอร์ชันเดียวกับ final-pleng)
2. สร้าง project ใหม่ → เลือก Empty Project
3. ตั้ง folder structure แบบนี้:
   assets/
   ├── Script/      ← TypeScript files
   ├── Scene/       ← .fire scene files
   ├── Animation/   ← .anim files
   ├── BGM/         ← เพลง
   ├── effectsound/ ← SFX
   ├── Tiled/       ← map .tmx files
   └── resources/   ← JSON data
```

---

## Step 4: แบ่งงานตาม Codebase Guide

โครงสร้าง scripts ที่ต้องทำ:

```
scripts/
├── core/
│   ├── GameManager.js      ← state ทั้งเกม
│   ├── PlayerController.js ← เดิน/interact
│   ├── BoothTrigger.js     ← เข้า mini-game
│   └── EndingManager.js    ← จบเกม
├── ui/
│   ├── HUDController.js    ← heart/score display
│   └── DialogueSystem.js   ← พูดคุยกับ NPC
└── minigames/
    └── MiniGameBase.js     ← base class ทุก mini-game
```

---

## Step 5: Timeline แนะนำ

| สัปดาห์ | เป้าหมาย |
|---------|---------|
| 5/12–5/18 | ติดตั้ง tools, request assets (ก่อน 5/26!), สร้าง map NTHU ด้วย Tiled |
| 5/19–5/26 | Main world (เดินได้, NPC ได้, dialogue ได้) + submit asset form |
| 5/27–6/2 | Mini-game แรก (เลือก 1 ง่ายสุดก่อน) |
| 6/3–6/9 | Mini-game ที่ 2-3 + Leaderboard (Firebase) |
| 6/10–6/16 | Polish, เชื่อม ending, bug fix |
| 6/17+ | Deploy + final demo |

---

## สรุป Action Items ด่วนสุด

1. **วันนี้–พรุ่งนี้**: ดาวน์โหลด Cocos Creator 2.4.8
2. **ก่อน 5/26 23:59**: กรอก申請表單 ขอ assets ตามรายการด้านบน
3. **สัปดาห์นี้**: เปิดดู final-pleng ให้เข้าใจโครงสร้างก่อน แล้วค่อย copy แนวทางมา
