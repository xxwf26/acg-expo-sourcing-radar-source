import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { EyeIcon, EyeOffIcon, Radar } from 'lucide-react';
import RadarScope from '@/pages/RadarDashboardPage/RadarScope';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('__saved_creds');
      if (saved) {
        const creds = JSON.parse(saved);
        setUsername(creds.username ?? '');
        setRememberMe(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    if (!rememberMe) localStorage.removeItem('__saved_creds');

    setLoading(true);
    try {
      await login(username, password, rememberMe);
      toast.success('登录成功');
    } catch {
      toast.error('用户名或密码错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-canvas flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-3xl overflow-hidden rounded-2xl border bg-card shadow-2xl md:grid-cols-2">
        {/* 左侧：深色雷达视觉 */}
        <div className="radar-hero relative hidden flex-col justify-between p-8 md:flex">
          <div className="relative z-10 flex items-center gap-2.5 text-white">
            <div className="flex size-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
              <Radar className="size-5" />
            </div>
            <span className="font-bold">寻源建联雷达</span>
          </div>
          <div className="relative z-10 mx-auto my-4 h-40 w-40">
            <RadarScope />
          </div>
          <div className="relative z-10">
            <p className="text-lg font-bold text-white">汇聚展会机会，沉淀给整个组</p>
            <p className="mt-2 text-sm leading-relaxed text-teal-50/75">
              艺术家、大厂嘉宾、周边供应商、零售渠道与社区节点，按采购匹配度优先级一站式管理。
            </p>
          </div>
        </div>

        {/* 右侧：表单 */}
        <div className="p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold">欢迎回来</h2>
            <p className="mt-1 text-sm text-muted-foreground">登录以继续使用采购寻源雷达</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">用户名</label>
              <input
                autoComplete="username"
                className="w-full rounded-lg border border-input px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin 或 viewer"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={rememberMe ? 'current-password' : 'off'}
                  className="w-full rounded-lg border border-input px-3 py-2.5 pr-9 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 cursor-pointer rounded accent-primary"
                />
                <span className="text-sm text-foreground">记住我</span>
              </label>
              <span className="text-xs text-muted-foreground">
                {rememberMe ? '有效期 30 天' : '有效期 8 小时'}
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-primary to-teal-600 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50"
            >
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-5 rounded-lg bg-accent/60 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-accent-foreground">测试账号（仅开发环境显示）</p>
              <p>管理员：admin / admin123（可改建联状态）</p>
              <p>只读：viewer / viewer123（仅浏览）</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
