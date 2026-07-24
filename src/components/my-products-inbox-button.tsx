import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useMyProductsUnread } from "@/hooks/use-my-products-unread";

export function MyProductsInboxButton() {
  const { total } = useMyProductsUnread();
  return (
    <Link
      to="/notificacoes"
      title="Notificações — aprovações e menções"
      className="relative size-9 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
    >
      <Inbox className="size-4" />
      {total > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold grid place-items-center">
          {total > 9 ? "9+" : total}
        </span>
      )}
    </Link>
  );
}
