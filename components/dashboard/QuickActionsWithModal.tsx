'use client'

import { useState, useEffect } from 'react'
import { X, Plus, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface NuevoPedidoProps {
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: FormData) => void
}

interface FormData {
  cliente: string
  telefono: string
  producto: string
  cantidad: number | null
  precioUnitario: number | null
  direccionEntrega: string
}

export default function NuevoPedidoModal({ isOpen, onClose, onSubmit }: NuevoPedidoProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    cliente: '',
    telefono: '',
    producto: '',
    cantidad: null,
    precioUnitario: null,
    direccionEntrega: '',
  })

  const [errors, setErrors] = useState<Partial<FormData>>({})

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      setTimeout(() => setIsAnimating(true), 10)
    } else {
      setIsAnimating(false)
      setTimeout(() => setIsVisible(false), 200)
    }
  }, [isOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'cantidad' || name === 'precioUnitario') {
      const parsedValue = value.trim() === '' ? null : parseFloat(value);
      setFormData(prev => ({ ...prev, [name]: parsedValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name as keyof FormData]: undefined }));
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {}
    if (!formData.cliente.trim()) newErrors.cliente = 'Requerido'
    if (!formData.telefono.trim()) newErrors.telefono = 'Requerido'
    if (!formData.producto.trim()) newErrors.producto = 'Requerido'
    if (formData.cantidad === null || formData.cantidad <= 0) newErrors.cantidad
    if (formData.precioUnitario === null || formData.precioUnitario <= 0) newErrors.precioUnitario
    if (!formData.direccionEntrega.trim()) newErrors.direccionEntrega = 'Requerido'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit?.(formData as FormData)
      setFormData({ cliente: '', telefono: '', producto: '', cantidad: null, precioUnitario: null, direccionEntrega: '' })
      onClose()
    }
  }

  const handleCancel = () => {
    setFormData({ cliente: '', telefono: '', producto: '', cantidad: null, precioUnitario: null, direccionEntrega: '' })
    setErrors({})
    onClose()
  }

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 bg-black flex items-center justify-center z-50 transition-all duration-200 ease-out ${isAnimating ? 'bg-opacity-50' : 'bg-opacity-0'
        }`}
    >
      <Card
        className={`w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-xl border-0 bg-white/70 backdrop-blur-sm transition-all duration-300 ease-out ${isAnimating
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4'
          }`}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Nuevo Pedido - China (Al Detal)</CardTitle>
          <Button onClick={handleCancel} variant="ghost" size="sm" className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Cliente</label>
                <input
                  type="text"
                  name="cliente"
                  placeholder="Nombre del cliente"
                  value={formData.cliente}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#EE3C23] focus:border-transparent ${errors.cliente ? 'border-[#EE3C23]' : 'border-gray-300'
                    }`}
                />
                {errors.cliente && <p className="text-[#EE3C23] text-xs mt-1">{errors.cliente}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Teléfono</label>
                <input
                  type="tel"
                  name="telefono"
                  placeholder="+86 xxx xxx xxxx"
                  value={formData.telefono}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#EE3C23] focus:border-transparent ${errors.telefono ? 'border-[#EE3C23]' : 'border-gray-300'
                    }`}
                />
                {errors.telefono && <p className="text-[#EE3C23] text-xs mt-1">{errors.telefono}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Producto</label>
              <select
                name="producto"
                value={formData.producto}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#EE3C23] focus:border-transparent ${errors.producto ? 'border-[#EE3C23]' : 'border-gray-300'
                  }`}
              >
                <option value="">Seleccionar producto</option>
                <option value="electronica">Electrónica</option>
                <option value="ropa">Ropa</option>
                <option value="accesorios">Accesorios</option>
                <option value="hogar">Hogar</option>
                <option value="juguetes">Juguetes</option>
                <option value="otros">Otros</option>
              </select>
              {errors.producto && <p className="text-[#EE3C23] text-xs mt-1">{errors.producto}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Cantidad</label>
                <input
                  type="number"
                  name="cantidad"
                  placeholder="Cantidad (máx. 100)"
                  min="1"
                  max="100"
                  value={formData.cantidad ?? ''}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#EE3C23] focus:border-transparent ${errors.cantidad ? 'border-[#EE3C23]' : 'border-gray-300'
                    }`}
                />
                {errors.cantidad && <p className="text-[#EE3C23] text-xs mt-1">{errors.cantidad}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Precio Unitario (¥)</label>
                <input
                  type="number"
                  name="precioUnitario"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={formData.precioUnitario ?? ''}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#EE3C23] focus:border-transparent ${errors.precioUnitario ? 'border-[#EE3C23]' : 'border-gray-300'
                    }`}
                />
                {errors.precioUnitario && <p className="text-[#EE3C23] text-xs mt-1">{errors.precioUnitario}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dirección de Entrega</label>
              <textarea
                name="direccionEntrega"
                placeholder="Dirección completa de entrega"
                rows={3}
                value={formData.direccionEntrega}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#EE3C23] focus:border-transparent resize-none ${errors.direccionEntrega ? 'border-[#EE3C23]' : 'border-gray-300'
                  }`}
              />
              {errors.direccionEntrega && <p className="text-[#EE3C23] text-xs mt-1">{errors.direccionEntrega}</p>}
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#EE3C23] to-[#d63419] hover:from-[#d63419] hover:to-[#c22e15] text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Pedido
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function QuickActionsWithModal() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleSubmit = (data: FormData) => {

  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-white/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-gradient-to-r from-[#EE3C23] to-[#d63419] hover:from-[#d63419] hover:to-[#c22e15] text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Pedido (China)
          </Button>
          <Button className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Pedido (Vzla)
          </Button>
          <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
            <RefreshCw className="w-4 h-4 mr-2" />
            Avanzar Todos los Pedidos
          </Button>
        </CardContent>
      </Card>

      <NuevoPedidoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}