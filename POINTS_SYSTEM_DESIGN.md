# 圖片生成點數系統設計文件

## 概述
實現學生圖片生成的點數限制系統，由管理員分配點數，學生使用時消耗點數。

## 1. 資料庫設計

### 1.1 用戶Profile擴展
```typescript
interface UserProfile {
  // 現有欄位
  name?: string;
  class?: string;
  chineseGroup?: string;
  englishGroup?: string;
  mathGroup?: string;

  // 新增點數欄位
  imageGenerationPoints?: number;  // 目前可用點數，預設0
  totalPointsReceived?: number;    // 累計獲得點數，預設0
  pointsUsed?: number;             // 累計使用點數，預設0
  lastPointUpdate?: string;        // 最後點數更新時間
}
```

### 1.2 點數交易記錄
```typescript
interface PointTransaction {
  id: string;                     // 交易ID
  userId: string;                 // 學生ID
  type: 'admin_grant' | 'image_generation' | 'admin_adjust'; // 交易類型
  amount: number;                 // 變動數量(正數=增加,負數=扣除)
  balance: number;                // 交易後餘額
  description?: string;           // 交易描述
  adminId?: string;               // 執行管理員ID(admin操作時)
  createdAt: string;              // 交易時間
  metadata?: {
    imagePrompt?: string;         // 圖片生成的prompt
    imageId?: string;             // 生成的圖片ID
    batchId?: string;             // 批次分配ID
  };
}
```

## 2. API接口設計

### 2.1 Admin管理接口

#### 查看所有學生點數狀態
```
GET /api/admin/students/points
Response: {
  students: [{
    userId: string;
    username: string;
    name: string;
    class: string;
    currentPoints: number;
    totalReceived: number;
    totalUsed: number;
    lastUpdate: string;
  }]
}
```

#### 分配點數給學生
```
POST /api/admin/students/{userId}/points/grant
Body: {
  amount: number;        // 分配數量
  description?: string;  // 分配說明
}
Response: {
  success: boolean;
  newBalance: number;
  transaction: PointTransaction;
}
```

#### 批次分配點數
```
POST /api/admin/students/points/batch-grant
Body: {
  studentIds: string[];  // 學生ID列表(空則為全部學生)
  amount: number;        // 每人分配數量
  description?: string;  // 分配說明
  filterBy?: {          // 篩選條件
    class?: string;
    role?: 'student';
  }
}
Response: {
  success: boolean;
  processedCount: number;
  transactions: PointTransaction[];
}
```

#### 查看點數交易記錄
```
GET /api/admin/points/transactions?userId={userId}&limit={limit}&offset={offset}
Response: {
  transactions: PointTransaction[];
  total: number;
}
```

### 2.2 Student使用接口

#### 查看點數餘額
```
GET /api/student/points/balance
Response: {
  currentPoints: number;
  totalReceived: number;
  totalUsed: number;
  lastUpdate: string;
}
```

#### 查看使用記錄
```
GET /api/student/points/history?limit={limit}&offset={offset}
Response: {
  transactions: PointTransaction[];
  total: number;
}
```

#### 圖片生成(扣點數)
```
POST /api/student/image-generation/create
Body: {
  prompt: string;
  style?: string;
  // 其他圖片生成參數
}
Response: {
  success: boolean;
  imageUrl?: string;
  remainingPoints: number;
  error?: 'insufficient_points' | 'generation_failed';
}
```

## 3. 前端界面設計

### 3.1 Admin管理面板

#### 3.1.1 點數總覽面板
```typescript
// components/admin/panels/AdminPointsPanel.tsx
interface PointsOverview {
  totalStudents: number;
  totalPointsDistributed: number;
  totalPointsUsed: number;
  averagePointsPerStudent: number;
}
```

**功能包含**：
- 點數統計總覽
- 學生點數列表(可排序、搜尋)
- 批次分配點數功能
- 個別學生點數調整
- 交易記錄查詢

#### 3.1.2 學生點數管理表格
| 學生姓名 | 班級 | 帳號 | 可用點數 | 總獲得 | 已使用 | 最後更新 | 操作 |
|---------|------|------|----------|--------|--------|----------|------|
| 張三    | 5A   | s001 | 15       | 20     | 5      | 2024-12-25 | [分配][調整] |

### 3.2 學生使用界面

#### 3.2.1 點數顯示組件
```typescript
// components/student/PointsBalance.tsx
// 在StudentDashboard中顯示點數餘額
<div className="points-indicator">
  <span>圖片生成點數: {currentPoints}</span>
  <button onClick={showHistory}>查看記錄</button>
</div>
```

#### 3.2.2 圖片生成前確認
```typescript
// 在圖片生成前顯示確認對話框
<PointsConfirmModal
  currentPoints={15}
  costPerGeneration={1}
  onConfirm={handleGenerate}
  onCancel={handleCancel}
/>
```

## 4. 系統配置

### 4.1 點數消耗設定
```typescript
// 系統配置(可在admin中調整)
interface PointsConfig {
  imageGenerationCost: number;     // 每次圖片生成消耗點數，預設1
  maxPointsPerStudent: number;     // 學生最大持有點數，預設100
  defaultPointsForNewStudent: number; // 新學生預設點數，預設0
}
```

### 4.2 權限控制
- **Admin**: 可查看所有學生點數、分配點數、查看所有交易記錄
- **Teacher**: 可查看自己班級學生點數狀況(只讀)
- **Student**: 只能查看自己的點數和使用記錄

## 5. 實作步驟

### Phase 1: 基礎架構
1. 擴展用戶profile資料結構
2. 建立點數交易記錄系統
3. 實作基礎API接口

### Phase 2: Admin管理功能
1. 在AdminDashboard新增點數管理面板
2. 實作點數分配和調整功能
3. 實作交易記錄查詢功能

### Phase 3: Student使用功能
1. 在StudentDashboard顯示點數餘額
2. 修改圖片生成流程加入點數檢查
3. 實作點數使用記錄查詢

### Phase 4: 進階功能
1. 批次點數分配
2. 點數使用統計報表
3. 點數到期機制(可選)

## 6. 安全考量

- API接口需要適當的權限驗證
- 點數變動需要完整的審計記錄
- 防止重複扣除點數(冪等性)
- 防止負點數餘額

## 7. 錯誤處理

### 7.1 常見錯誤情境
- 點數不足無法生成圖片
- 網路中斷導致重複扣點
- 圖片生成失敗但已扣點

### 7.2 處理策略
- 樂觀鎖定防止併發問題
- 交易補償機制
- 詳細錯誤日誌記錄