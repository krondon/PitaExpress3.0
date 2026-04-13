"use client";
import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Calculator,
  User,
  Tag,
  Calendar,
  Truck,
  MapPin,
  FileText,
  Search,
  XCircle,
  Package,
} from "lucide-react";

// ========================================
// Tipo de pedido que el modal necesita
// ========================================
export interface OrderDetailPedido {
  id: number;
  producto: string;
  cliente: string;
  cantidad: number;
  fecha: string;
  numericState?: number;
  imgs?: string[];
  links?: string[];
  description?: string;
  especificaciones?: string;
  shippingType?: string;
  deliveryType?: string;
  unitQuote?: number | null;
  shippingPrice?: number | null;
  totalQuote?: number | null;
}

// ========================================
// Badge de estado reutilizable
// ========================================
function getOrderBadge(stateNum: number | undefined, isDark: boolean) {
  const s = Number(stateNum ?? 0);
  const base = "border";
  if (s === -2 || s === -1 || s === 0)
    return {
      label: "Cancelado",
      className: `${base} ${isDark ? "bg-red-900/30 text-red-300 border-red-700" : "bg-red-100 text-red-800 border-red-200"}`,
    };
  if (s === 1 || s === 2)
    return {
      label: "Pendiente",
      className: `${base} ${isDark ? "bg-yellow-900/30 text-yellow-300 border-yellow-700" : "bg-yellow-100 text-yellow-800 border-yellow-200"}`,
    };
  if (s === 3)
    return {
      label: "Cotizado",
      className: `${base} ${isDark ? "bg-blue-900/30 text-blue-300 border-blue-700" : "bg-blue-100 text-blue-800 border-blue-200"}`,
    };
  if (s === 4)
    return {
      label: "Procesando",
      className: `${base} ${isDark ? "bg-purple-900/30 text-purple-300 border-purple-700" : "bg-purple-100 text-purple-800 border-purple-200"}`,
    };
  if (s === 5)
    return {
      label: "Listo para empaquetar",
      className: `${base} ${isDark ? "bg-amber-900/30 text-amber-300 border-amber-700" : "bg-amber-100 text-amber-800 border-amber-200"}`,
    };
  if (s === 6)
    return {
      label: "En caja",
      className: `${base} ${isDark ? "bg-indigo-900/30 text-indigo-300 border-indigo-700" : "bg-indigo-100 text-indigo-800 border-indigo-200"}`,
    };
  if (s === 7 || s === 8)
    return {
      label: "En contenedor",
      className: `${base} ${isDark ? "bg-cyan-900/30 text-cyan-300 border-cyan-700" : "bg-cyan-100 text-cyan-800 border-cyan-200"}`,
    };
  if (s === 9)
    return {
      label: "Enviado a Vzla",
      className: `${base} ${isDark ? "bg-green-900/30 text-green-300 border-green-700" : "bg-green-100 text-green-800 border-green-200"}`,
    };
  if (s === 10)
    return {
      label: "En Venezuela",
      className: `${base} ${isDark ? "bg-yellow-900/30 text-yellow-300 border-yellow-700" : "bg-yellow-100 text-yellow-800 border-yellow-200"}`,
    };
  if (s === 11)
    return {
      label: "En almacén Vzla",
      className: `${base} ${isDark ? "bg-orange-900/30 text-orange-300 border-orange-700" : "bg-orange-100 text-orange-800 border-orange-200"}`,
    };
  if (s === 12)
    return {
      label: "Listo entrega",
      className: `${base} ${isDark ? "bg-lime-900/30 text-lime-300 border-lime-700" : "bg-lime-100 text-lime-800 border-lime-200"}`,
    };
  if (s === 13)
    return {
      label: "Entregado",
      className: `${base} ${isDark ? "bg-emerald-900/30 text-emerald-300 border-emerald-700" : "bg-emerald-100 text-emerald-800 border-emerald-200"}`,
    };
  if (s > 13)
    return {
      label: "Enviado a Vzla",
      className: `${base} ${isDark ? "bg-green-900/30 text-green-300 border-green-700" : "bg-green-100 text-green-800 border-green-200"}`,
    };
  return {
    label: `Estado ${s}`,
    className: `${base} ${isDark ? "bg-gray-800 text-gray-300 border-gray-700" : "bg-gray-100 text-gray-800 border-gray-200"}`,
  };
}

// ========================================
// Labels de envío / entrega
// ========================================
const shippingLabels: Record<string, string> = {
  air: "Aéreo",
  maritime: "Marítimo",
  doorToDoor: "Puerta a puerta",
};
const deliveryLabels: Record<string, string> = {
  office: "Oficina",
  warehouse: "Almacén",
  express: "Express",
  pickup: "Retiro en tienda",
  delivery: "Entrega a domicilio",
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
interface OrderDetailModalProps {
  open: boolean;
  pedido?: OrderDetailPedido | null;
  onClose: () => void;
}

export default function OrderDetailModal({
  open,
  pedido,
  onClose,
}: OrderDetailModalProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cerrar lightbox al presionar Escape
  useEffect(() => {
    if (!lightboxImg) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImg(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxImg]);

  // Cerrar modal al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (lightboxImg) return; // No cerrar si el lightbox está abierto
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, lightboxImg]);

  // Bloquear scroll cuando está abierto
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setLightboxImg(null);
    }, 300);
  };

  if (!open || !pedido) return null;

  const p = pedido;
  const isDark = mounted && theme === "dark";
  const badge = getOrderBadge(p.numericState, isDark);
  const hasQuote =
    (p.unitQuote != null && Number(p.unitQuote) > 0) ||
    (p.shippingPrice != null && Number(p.shippingPrice) > 0) ||
    (p.totalQuote != null && Number(p.totalQuote) > 0);
  const productImg = p.imgs && p.imgs.length > 0 ? p.imgs[0] : null;

  return (
    <>
      {/* Lightbox de imagen */}
      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] animate-in fade-in duration-200 cursor-pointer p-6"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxImg(null);
          }}
          tabIndex={0}
        >
          <img
            src={lightboxImg}
            alt="Vista ampliada"
            className="max-w-full max-h-full rounded-xl object-contain shadow-2xl animate-in zoom-in-90 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors"
          >
            <XCircle className="h-8 w-8" />
          </button>
        </div>
      )}

      {/* Modal Detalle del Pedido */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300 p-4">
        <div
          ref={modalRef}
          className={`${isDark ? "bg-slate-800" : "bg-white"} rounded-2xl w-full max-w-lg md:max-w-2xl max-h-[85vh] overflow-y-auto transition-all duration-300 ${
            isClosing
              ? "translate-y-full scale-95 opacity-0"
              : "animate-in slide-in-from-bottom-4 duration-300"
          }`}
        >
          {/* Header */}
          <div
            className={`sticky top-0 z-10 ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"} border-b px-5 py-4 rounded-t-2xl`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3
                  className={`text-lg font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  <span
                    className={`font-mono ${isDark ? "text-slate-400" : "text-gray-400"}`}
                  >
                    #ORD-{p.id}
                  </span>{" "}
                  {p.producto || "Sin nombre"}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className={`h-8 w-8 p-0 shrink-0 ${isDark ? "hover:bg-slate-700" : ""}`}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* F-Pattern: Imagen izq + datos der (desktop) / stacked (mobile) */}
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              {/* Columna izquierda — Imagen */}
              {productImg && (
                <div className="md:w-2/5 shrink-0">
                  <div
                    className={`rounded-xl overflow-hidden border ${isDark ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-gray-100"} cursor-pointer group relative`}
                    onClick={() => setLightboxImg(productImg)}
                  >
                    <img
                      src={productImg}
                      alt={p.producto}
                      className="w-full h-48 md:h-56 object-cover transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Search className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              )}

              {/* Columna derecha — Datos principales */}
              <div className={`flex-1 ${!productImg ? "w-full" : ""}`}>
                <div
                  className={`rounded-xl border ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"} p-4 space-y-3`}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span
                        className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                      >
                        <User className="h-3 w-3 inline mr-1" />
                        Cliente
                      </span>
                      <p
                        className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {p.cliente || "—"}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                      >
                        <Tag className="h-3 w-3 inline mr-1" />
                        Cantidad
                      </span>
                      <p
                        className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {p.cantidad}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                      >
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Fecha
                      </span>
                      <p
                        className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        {p.fecha
                          ? new Date(p.fecha).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                      >
                        Estado
                      </span>
                      <div className="mt-1">
                        <Badge className={badge.className}>
                          {badge.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Envío inline */}
                  <div
                    className={`pt-3 border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span
                          className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                        >
                          <Truck className="h-3 w-3 inline mr-1" />
                          Tipo de envío
                        </span>
                        <p
                          className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                        >
                          {shippingLabels[p.shippingType || ""] ||
                            p.shippingType ||
                            "—"}
                        </p>
                      </div>
                      <div>
                        <span
                          className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                        >
                          <MapPin className="h-3 w-3 inline mr-1" />
                          Entrega
                        </span>
                        <p
                          className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                        >
                          {deliveryLabels[p.deliveryType || ""] ||
                            p.deliveryType ||
                            "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Links — full width debajo del F-pattern */}
            {p.links && p.links.length > 0 && (
              <div
                className={`rounded-xl border ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"} p-4`}
              >
                <span
                  className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  🔗 Links del producto
                </span>
                <div className="mt-2 space-y-1.5">
                  {p.links.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-500 hover:text-blue-400 hover:underline truncate"
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Descripción */}
            {p.description && (
              <div
                className={`rounded-xl border ${isDark ? "border-slate-700 bg-slate-800/50" : "border-gray-200 bg-gray-50"} p-4`}
              >
                <span
                  className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  <FileText className="h-3 w-3 inline mr-1" />
                  Descripción
                </span>
                <p
                  className={`text-sm mt-1.5 whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  {p.description}
                </p>
              </div>
            )}

            {/* Especificaciones técnicas */}
            {p.especificaciones && (
              <div
                className={`rounded-xl border ${isDark ? "border-amber-900/40 bg-amber-900/10" : "border-amber-200 bg-amber-50"} p-4`}
              >
                <span
                  className={`text-xs font-medium ${isDark ? "text-amber-300" : "text-amber-700"}`}
                >
                  ⚙️ Especificaciones técnicas
                </span>
                <p
                  className={`text-sm mt-1.5 whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-gray-700"}`}
                >
                  {p.especificaciones}
                </p>
              </div>
            )}

            {/* Cotización */}
            {hasQuote && (
              <div
                className={`rounded-xl border ${isDark ? "border-blue-900/50 bg-blue-900/20" : "border-blue-200 bg-blue-50"} p-4`}
              >
                <span
                  className={`text-xs font-medium ${isDark ? "text-blue-300" : "text-blue-600"}`}
                >
                  <Calculator className="h-3 w-3 inline mr-1" />
                  Cotización
                </span>
                <div className="mt-2 space-y-1.5">
                  {p.unitQuote != null && Number(p.unitQuote) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span
                        className={
                          isDark ? "text-slate-300" : "text-gray-600"
                        }
                      >
                        Precio unitario
                      </span>
                      <span
                        className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                      >
                        ¥{Number(p.unitQuote).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {p.shippingPrice != null &&
                    Number(p.shippingPrice) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span
                          className={
                            isDark ? "text-slate-300" : "text-gray-600"
                          }
                        >
                          Envío
                        </span>
                        <span
                          className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                        >
                          ¥{Number(p.shippingPrice).toFixed(2)}
                        </span>
                      </div>
                    )}
                  {p.totalQuote != null && Number(p.totalQuote) > 0 && (
                    <div
                      className={`flex justify-between text-sm pt-1.5 border-t ${isDark ? "border-blue-800" : "border-blue-200"}`}
                    >
                      <span
                        className={`font-bold ${isDark ? "text-blue-300" : "text-blue-700"}`}
                      >
                        Total
                      </span>
                      <span
                        className={`font-bold text-base ${isDark ? "text-blue-300" : "text-blue-700"}`}
                      >
                        ${Number(p.totalQuote).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className={`sticky bottom-0 ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"} border-t px-5 py-3 rounded-b-2xl`}
          >
            <Button variant="outline" onClick={handleClose} className="w-full">
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
