# 點數系統整合示例

## 1. 在StudentDashboard中整合點數顯示

### 1.1 修改StudentDashboard.tsx

```typescript
// 在StudentDashboard.tsx頂部導入
import PointsBalance from '../components/student/PointsBalance';
import ImageGenerationConfirmModal from '../components/student/ImageGenerationConfirmModal';

// 在組件內部添加狀態
const [userPoints, setUserPoints] = useState({
  currentPoints: 0,
  totalReceived: 0,
  totalUsed: 0,
  lastUpdate: ''
});
const [pointsTransactions, setPointsTransactions] = useState([]);
const [showImageConfirm, setShowImageConfirm] = useState(false);
const [imagePrompt, setImagePrompt] = useState('');

// 添加獲取點數的函數
useEffect(() => {
  const loadUserPoints = async () => {
    try {
      const response = await authService.getUserPoints();
      setUserPoints(response);

      const transactions = await authService.getPointsHistory();
      setPointsTransactions(transactions);
    } catch (error) {
      console.error('Failed to load points:', error);
    }
  };

  if (user) {
    loadUserPoints();
  }
}, [user]);

// 在學生信息區塊後添加點數顯示
{/* Student Info Section */}
<div className="text-center mb-6 bg-white/60 rounded-xl p-4 border-2 border-[#E6D2B5]">
  {/* 現有的學生信息... */}
</div>

{/* Points Balance Section */}
<PointsBalance
  currentPoints={userPoints.currentPoints}
  totalReceived={userPoints.totalReceived}
  totalUsed={userPoints.totalUsed}
  lastUpdate={userPoints.lastUpdate}
  transactions={pointsTransactions}
  onRefresh={loadUserPoints}
/>
```

### 1.2 修改AI對話模態框整合圖片生成確認

```typescript
// 在AiChatModal或圖片生成功能中添加點數檢查
const handleImageGeneration = (prompt: string) => {
  setImagePrompt(prompt);
  setShowImageConfirm(true);
};

const handleConfirmImageGeneration = async () => {
  try {
    const response = await authService.generateImageWithPoints(imagePrompt);
    if (response.success) {
      // 更新點數餘額
      setUserPoints(prev => ({
        ...prev,
        currentPoints: response.remainingPoints,
        totalUsed: prev.totalUsed + 1
      }));

      // 顯示生成的圖片
      setGeneratedImage(response.imageUrl);
    } else {
      alert(response.error === 'insufficient_points' ? '點數不足' : '生成失敗');
    }
  } catch (error) {
    console.error('Image generation failed:', error);
  } finally {
    setShowImageConfirm(false);
  }
};

// 在模態框中添加確認組件
<ImageGenerationConfirmModal
  open={showImageConfirm}
  currentPoints={userPoints.currentPoints}
  costPerGeneration={1}
  prompt={imagePrompt}
  onConfirm={handleConfirmImageGeneration}
  onCancel={() => setShowImageConfirm(false)}
  isGenerating={isGenerating}
/>
```

## 2. 在AdminDashboard中整合點數管理

### 2.1 修改AdminDashboard.tsx

```typescript
// 導入點數管理面板
import AdminPointsPanel from '../components/admin/panels/AdminPointsPanel';

// 在sidebar中添加點數管理選項
import { Coins } from 'lucide-react';

const sidebarItems = [
  // 現有項目...
  { key: 'points', label: '點數管理', icon: <Coins className="w-5 h-5" /> },
];

// 在主要內容區域添加點數面板
{activeSection === 'points' && (
  <AdminPointsPanel
    studentsPoints={studentsPointsData}
    overview={pointsOverview}
    transactions={pointsTransactions}
    onGrantPoints={handleGrantPoints}
    onBatchGrantPoints={handleBatchGrantPoints}
    onAdjustPoints={handleAdjustPoints}
  />
)}
```

### 2.2 實作API調用函數

```typescript
// 在authService.ts中添加點數相關方法
export const authService = {
  // 現有方法...

  // Student端方法
  async getUserPoints() {
    const response = await fetch('/api/student/points/balance', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  async getPointsHistory(limit = 50) {
    const response = await fetch(`/api/student/points/history?limit=${limit}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  async generateImageWithPoints(prompt: string) {
    const response = await fetch('/api/student/image-generation/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ prompt })
    });
    return response.json();
  },

  // Admin端方法
  async getStudentsPoints() {
    const response = await fetch('/api/admin/students/points', {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return response.json();
  },

  async grantPointsToStudent(userId: string, amount: number, description?: string) {
    const response = await fetch(`/api/admin/students/${userId}/points/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ amount, description })
    });
    return response.json();
  },

  async batchGrantPoints(studentIds: string[], amount: number, description?: string) {
    const response = await fetch('/api/admin/students/points/batch-grant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ studentIds, amount, description })
    });
    return response.json();
  }
};
```

## 3. 使用流程示例

### 3.1 Admin分配點數流程
1. Admin登入後進入點數管理面板
2. 查看所有學生的點數狀況
3. 選擇批次分配或個別分配
4. 填入點數數量和說明
5. 確認分配，系統記錄交易

### 3.2 Student使用點數流程
1. Student在儀表板看到點數餘額
2. 進入AI對話功能，輸入圖片描述
3. 系統顯示點數確認對話框
4. Student確認消耗點數
5. 生成圖片，扣除點數，更新餘額

### 3.3 錯誤處理流程
1. 點數不足：顯示警告，提示聯繫老師
2. 網路錯誤：保留操作狀態，允許重試
3. 生成失敗：退回扣除的點數，記錄補償交易

## 4. 測試檢查清單

### 4.1 基礎功能測試
- [ ] Admin可以查看所有學生點數狀況
- [ ] Admin可以分配點數給個別學生
- [ ] Admin可以批次分配點數
- [ ] Student可以查看自己的點數餘額
- [ ] Student可以查看點數使用記錄

### 4.2 圖片生成測試
- [ ] 點數足夠時可以正常生成圖片
- [ ] 點數不足時顯示錯誤提示
- [ ] 生成成功後正確扣除點數
- [ ] 生成失敗時不扣除點數

### 4.3 安全性測試
- [ ] 學生無法修改自己的點數
- [ ] 學生無法查看其他人的點數
- [ ] Admin操作有適當的權限檢查
- [ ] 防止重複扣除點數

### 4.4 UI/UX測試
- [ ] 點數顯示清楚易懂
- [ ] 確認對話框提供足夠信息
- [ ] 錯誤訊息清楚明確
- [ ] 操作流程順暢自然