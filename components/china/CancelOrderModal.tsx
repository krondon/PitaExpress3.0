"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { XCircle, Package } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";

// ========================================
// COMPONENTE REUTILIZABLE: Modal Cancelar Pedido
// ========================================
interface CancelOrderModalProps {
  open: boolean;
  pedidoId?: number;
  pedidoName?: string;
  onClose: () => void;
  /** Callback que se ejecuta DESPUÉS de cancelar exitosamente para que el padre refresque datos */
  onCancelled?: () => void;
}

export default function CancelOrderModal({
  open,
  pedidoId,
  pedidoName,
  onClose,
  onCancelled,
}: CancelOrderModalProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  const handleCancel = async () => {
    if (!pedidoId) return;
    try {
      setCancelling(true);
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("orders")
        .update({ state: 0 })
        .eq("id", pedidoId);

      if (error) throw error;

      toast({
        title: "Pedido cancelado",
        description:
          "El pedido ha sido marcado como cancelado.",
      });
      onClose();
      onCancelled?.();
    } catch (error: any) {
      console.error("Error cancelling order:", error);
      toast({
        title: "Error",
        description:
          error.message || "No se pudo cancelar el pedido.",
      });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        className={`max-w-md ${isDark ? "bg-slate-800" : ""}`}
      >
        <DialogHeader>
          <DialogTitle
            className={`flex items-center gap-2 ${isDark ? "text-white" : ""}`}
          >
            <XCircle className="h-5 w-5 text-red-500" />
            Cancelar Pedido
          </DialogTitle>
          <DialogDescription className={isDark ? "text-slate-300" : ""}>
            ¿Estás seguro de que deseas cancelar este pedido? Esta acción no
            se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`p-4 rounded-lg border ${isDark ? "bg-slate-700/50 border-slate-600" : "bg-slate-50 border-slate-200"}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-100"}`}
            >
              <Package
                className={`h-5 w-5 ${isDark ? "text-blue-300" : "text-blue-600"}`}
              />
            </div>
            <div>
              <p
                className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
              >
                #ORD-{pedidoId}
              </p>
              <p
                className={`text-sm truncate max-w-[250px] ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                {pedidoName}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={cancelling}
            className={
              isDark ? "border-slate-600 hover:bg-slate-700" : ""
            }
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelling}
            className="bg-red-600 hover:bg-red-700"
          >
            <XCircle className="h-4 w-4 mr-2" />
            {cancelling ? "Cancelando..." : "Sí, cancelar pedido"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
