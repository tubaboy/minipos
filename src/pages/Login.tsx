import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Login() {
  const [pin, setPin] = useState('');
  const navigate = useNavigate();

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleLogin = () => {
    // Mock login for now
    if (pin === '123456') {
      navigate('/pos');
    } else {
      alert('員工編號錯誤 (測試請輸入 123456)');
      setPin('');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF5FF] flex flex-col items-center justify-center p-4">
      {/* Glassmorphism Card */}
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 flex flex-col items-center">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
          <Coffee className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="text-2xl font-bold text-primary mb-2">MiniPOS 點餐系統</h1>
        <p className="text-muted-foreground mb-8">請輸入員工編號登入</p>

        {/* PIN Display */}
        <div className="flex gap-3 mb-10">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-4 h-4 rounded-full border-2 border-primary/20 transition-all duration-200",
                pin.length > i ? "bg-primary border-primary scale-110" : "bg-transparent"
              )}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((key) => (
            <button
              key={key}
              onClick={() => {
                if (key === 'C') handleDelete();
                else if (key === 'OK') handleLogin();
                else handleNumberClick(key);
              }}
              className={cn(
                "h-16 rounded-2xl flex items-center justify-center text-xl font-semibold transition-all active:scale-95 cursor-pointer",
                key === 'OK' 
                  ? "bg-primary text-white hover:bg-primary/90" 
                  : "bg-white border border-primary/10 text-primary hover:bg-primary/5"
              )}
            >
              {key === 'OK' ? <Lock className="w-6 h-6" /> : key}
            </button>
          ))}
        </div>
      </div>
      
      <p className="mt-8 text-sm text-muted-foreground/60">© 2026 MiniPOS SaaS Solution</p>
    </div>
  );
}
