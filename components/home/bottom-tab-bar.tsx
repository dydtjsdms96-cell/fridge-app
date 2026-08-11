import Link from "next/link";
import { ChefHat, Home, Package2, Settings, ShoppingBag } from "lucide-react";

export type AppTab = "home" | "fridge" | "meal" | "list" | "settings";

const TABS: {
  id: AppTab;
  label: string;
  icon: typeof Home;
  href: string | null;
}[] = [
  { id: "home", label: "홈", icon: Home, href: "/" },
  { id: "fridge", label: "냉장고", icon: Package2, href: "/fridge" },
  { id: "meal", label: "식단", icon: ChefHat, href: "/meal" },
  { id: "list", label: "쇼핑", icon: ShoppingBag, href: "/shopping" },
  { id: "settings", label: "설정", icon: Settings, href: "/settings" },
];

type BottomTabBarProps = {
  activeTab: AppTab;
};

export function BottomTabBar({ activeTab }: BottomTabBarProps) {
  return (
    <nav
      className="flex w-full shrink-0 items-stretch border-t border-border bg-card px-1 pt-1"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      {TABS.map(({ id, label, icon: Icon, href }) => {
        const active = activeTab === id;
        const className =
          "touch-target flex flex-1 flex-col items-center justify-center gap-1 py-1";
        const content = (
          <>
            <div
              className={`flex size-8 items-center justify-center rounded-[20px] ${
                active ? "bg-secondary" : "bg-transparent"
              }`}
            >
              <Icon
                size={19}
                className={active ? "text-primary" : "text-muted-foreground"}
              />
            </div>
            <span
              className={`text-[9px] font-medium leading-[9px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </>
        );

        if (!href) {
          return (
            <div key={id} className={`${className} opacity-50`}>
              {content}
            </div>
          );
        }

        return (
          <Link
            key={id}
            href={href}
            className={className}
            aria-current={active ? "page" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
