# 前端（React + shadcn/ui 风格）

## 运行

1. 启动后端（默认 `http://localhost:8000`）
   - `./scripts/start.sh`
2. 启动前端
   - `cd frontend`
   - `npm install`
   - `npm run dev`

前端默认端口：`http://localhost:5173`

## 环境变量

可选：在 `frontend/.env.local` 设置后端地址（默认就是 `http://localhost:8000`）：

```
VITE_API_BASE_URL=http://localhost:8000
```

## 页面

- `/inventory`：库存列表、XLSX 导入导出、批量删除、单设备连接测试
- `/execute`：从库存选择设备，执行命令并查看回显

