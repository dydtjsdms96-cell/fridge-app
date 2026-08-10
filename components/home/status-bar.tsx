export function StatusBar() {
  return (
    <div className="flex h-12 w-full shrink-0 items-center justify-between px-7 pt-4 pb-1">
      <span className="font-mono text-[13px] font-medium text-foreground">9:41</span>
      <div className="flex items-center gap-2">
        <div className="flex h-[11px] items-end gap-[2.5px]">
          {[4, 6, 8, 10].map((h, i) => (
            <div
              key={h}
              className="w-[3px] rounded-sm"
              style={{
                height: h,
                backgroundColor: i < 3 ? "#1B1B19" : "rgba(27,27,25,0.25)",
              }}
            />
          ))}
        </div>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
          <circle cx="7.5" cy="10" r="1.2" fill="currentColor" />
          <path
            d="M4.5 7.2a4.2 4.2 0 0 1 6 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M2 4.5A7.5 7.5 0 0 1 13 4.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <div className="flex items-center gap-[2px]">
          <div className="relative h-[12px] w-6 rounded-[3px] border-[1.5px] border-foreground/60 p-[2px]">
            <div className="h-full w-[75%] rounded-[1px] bg-foreground" />
          </div>
          <div className="h-[5px] w-[2px] rounded-r-sm bg-foreground/50" />
        </div>
      </div>
    </div>
  );
}
