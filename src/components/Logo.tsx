import { cn } from '@/lib/utils';

export default function Logo({ className = "w-8 h-8", showText = false, light = false }: { className?: string, showText?: boolean, light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn(
        "relative flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden shadow-lg",
        light ? "bg-white" : "bg-indigo-600",
        className
      )}>
        {/* Stylized V / Speed Mark */}
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-2/3 h-2/3">
          <path 
            d="M5 13L10 18L19 7" 
            stroke={light ? "#4f46e5" : "white"} 
            strokeWidth="4" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="animate-in fade-in slide-in-from-left-2 duration-700"
          />
          <path 
            d="M2 7L7 12" 
            stroke={light ? "#818cf8" : "rgba(255,255,255,0.4)"} 
            strokeWidth="4" 
            strokeLinecap="round" 
            className="opacity-50"
          />
        </svg>
      </div>
      
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={cn("text-xl font-black tracking-tighter", light ? "text-white" : "text-slate-900")}>
            VELO
          </span>
          <span className={cn("text-[10px] font-black tracking-[0.2em] uppercase opacity-50", light ? "text-indigo-200" : "text-slate-400")}>
            Systems
          </span>
        </div>
      )}
    </div>
  );
}
