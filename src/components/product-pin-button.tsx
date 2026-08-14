import { useEffect, useState } from "react";
import { Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPinned, togglePinnedProduct } from "@/lib/recent-products";
import { toast } from "sonner";

export function ProductPinButton({ id, sku, name }: { id: string; sku: string; name: string }) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(isPinned(id));
    const onChange = () => setPinned(isPinned(id));
    window.addEventListener("plm:pinned-changed", onChange);
    return () => window.removeEventListener("plm:pinned-changed", onChange);
  }, [id]);

  return (
    <Button
      variant={pinned ? "default" : "outline"}
      size="sm"
      aria-label={pinned ? "Desafixar produto" : "Fixar produto no dashboard"}
      aria-pressed={pinned}
      onClick={() => {
        const now = togglePinnedProduct({ id, sku, name });
        toast.success(now ? "Produto fixado no dashboard" : "Produto desafixado");
      }}
    >
      {pinned ? <PinOff className="size-4 mr-1.5" /> : <Pin className="size-4 mr-1.5" />}
      {pinned ? "Fixado" : "Fixar"}
    </Button>
  );
}
