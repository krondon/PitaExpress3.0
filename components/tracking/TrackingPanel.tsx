// components/TrackingPanel.tsx
"use client";
import Image from 'next/image';

// Componente para mostrar el GIF de transporte según el tipo
const TransportGif = ({ transporte }: { transporte: string }) => {
  if (transporte === 'Aéreo') {
    return <Image src="/animations/viaje.gif" alt="Avión" width={40} height={40} className="w-10 h-10 object-contain" draggable={false} unoptimized />;
  }
  if (transporte === 'Marítimo') {
    return <Image src="/animations/barco.gif" alt="Barco" width={40} height={40} className="w-10 h-10 object-contain" draggable={false} unoptimized />;
  }
  if (transporte === 'Terrestre') {
    return <Image src="/animations/camion.gif" alt="Camión" width={40} height={40} className="w-10 h-10 object-contain" draggable={false} unoptimized />;
  }
  return null;
};

import React, { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle, Plane, Eye, Edit, Trash2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import StatusBadge from './ui/StatusBadge';
// import OrderDetailsModal from './ui/OrderDetailsModal';
// import EditOrderModal from './ui/EditOrderModal';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/ui/select';

// Interfaces de tipos para los datos
interface TrackingItem {
  id: string;
  usuario: string;
  pedido: string;
  transporte: 'Aéreo' | 'Marítimo' | 'Terrestre';
  estado: 'pedido-solicitado' | 'cotizacion-china' | 'cotizacion-venezuela' | 'cliente-paga' | 'validar-pago' | 're-empacar-china' | 'en-transito' | 'almacen-venezuela' | 'entregado';
  diasRestantes: number;
  fecha: string;
}

interface StatusCounts {
  total: number;
  enTransito: number;
  entregados: number;
  pendientes: number;
}
// Datos de ejemplo con el tipo TrackingItem
const trackingData: TrackingItem[] = [
  {
    id: 'PED-001',
    usuario: 'María García',
    pedido: 'Laptop Dell XPS 13',
    transporte: 'Aéreo',
    estado: 'en-transito',
    diasRestantes: 2,
    fecha: '2024-01-15'
  },
  {
    id: 'PED-002',
    usuario: 'Carlos Rodríguez',
    pedido: 'iPhone 15 Pro',
    transporte: 'Terrestre',
    estado: 'entregado',
    diasRestantes: 0,
    fecha: '2024-01-14'
  },
  {
    id: 'PED-003',
    usuario: 'Ana Martínez',
    pedido: 'Auriculares Sony WH-1000XM4',
    transporte: 'Marítimo',
    estado: 'cotizacion-china',
    diasRestantes: 5,
    fecha: '2024-01-16'
  },
  {
    id: 'PED-004',
    usuario: 'Luis Fernández',
    pedido: 'Monitor Samsung 27"',
    transporte: 'Aéreo',
    estado: 'pedido-solicitado',
    diasRestantes: 7,
    fecha: '2024-01-17'
  },
  {
    id: 'PED-005',
    usuario: 'Elena Jiménez',
    pedido: 'Teclado Mecánico Logitech',
    transporte: 'Terrestre',
    estado: 'validar-pago',
    diasRestantes: 3,
    fecha: '2024-01-13'
  },
  {
    id: 'PED-006',
    usuario: 'Roberto Silva',
    pedido: 'Tablet iPad Air',
    transporte: 'Aéreo',
    estado: 'almacen-venezuela',
    diasRestantes: 1,
    fecha: '2024-01-12'
  },
  {
    id: 'PED-007',
    usuario: 'Carmen López',
    pedido: 'Smartwatch Apple Watch',
    transporte: 'Marítimo',
    estado: 'cotizacion-venezuela',
    diasRestantes: 8,
    fecha: '2024-01-18'
  },
  {
    id: 'PED-008',
    usuario: 'Diego Morales',
    pedido: 'Cámara Canon EOS R5',
    transporte: 'Aéreo',
    estado: 'cliente-paga',
    diasRestantes: 4,
    fecha: '2024-01-19'
  },
  {
    id: 'PED-009',
    usuario: 'Patricia Ruiz',
    pedido: 'Drone DJI Mini 3',
    transporte: 'Terrestre',
    estado: 're-empacar-china',
    diasRestantes: 6,
    fecha: '2024-01-20'
  }
];

const getTransportIcon = (transporte: TrackingItem['transporte']) => {
  const icons = {
    'Aéreo': '✈️',
    'Marítimo': '🚢',
    'Terrestre': '🚚'
  };
  return icons[transporte] || '📦';
};

const getStatusCounts = (data: TrackingItem[]): StatusCounts => {
  return data.reduce((acc, item) => {
    if (item.estado === 'en-transito') acc.enTransito++;
    if (item.estado === 'entregado') acc.entregados++;
    // Un pedido se considera pendiente si no está entregado y tiene días restantes
    if (item.diasRestantes > 0 && item.estado !== 'entregado') acc.pendientes++;
    acc.total++;
    return acc;
  }, { total: 0, enTransito: 0, entregados: 0, pendientes: 0 });
};

const TrackingPanel = () => {
  const [data, setData] = useState<TrackingItem[]>(trackingData);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [transportFilter, setTransportFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<TrackingItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const counts = getStatusCounts(trackingData);
  // Animación de números
  const [animateStats, setAnimateStats] = useState(false);
  useEffect(() => {
    setTimeout(() => setAnimateStats(true), 200);
    return () => setAnimateStats(false);
  }, []);

  useEffect(() => {
    const filteredData = trackingData.filter(item => {
      const matchesSearch = item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.pedido.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || item.estado === statusFilter;
      const matchesTransport = transportFilter === 'all' || item.transporte.toLowerCase() === transportFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesTransport;
    });
    setData(filteredData);
  }, [searchTerm, statusFilter, transportFilter]);

  const handleView = (order: TrackingItem) => {
    setSelectedOrder(order);
    setShowDetails(true);
  };

  const handleEdit = (order: TrackingItem) => {
    setSelectedOrder(order);
    setShowEdit(true);
  };

  const handleSaveEdit = (editedOrder: TrackingItem) => {
    setData(prev => prev.map(o => o.id === editedOrder.id ? editedOrder : o));
    setShowEdit(false);
    setSelectedOrder(null);
  };

  const handleDeleteOrder = (orderId: string) => {
    setData(prev => prev.filter(o => o.id !== orderId));
    setShowEdit(false);
    setSelectedOrder(null);
  };

  return (
    <>
      <div className="px-2 sm:px-8 lg:px-12 py-10">
        {/* Modales de detalles y edición */}
        {/* TODO: Uncomment when OrderDetailsModal and EditOrderModal are implemented
        {showDetails && selectedOrder && (
          <OrderDetailsModal order={selectedOrder} onClose={() => { setShowDetails(false); setSelectedOrder(null); }} />
        )}
        {showEdit && selectedOrder && (
          <EditOrderModal
            order={selectedOrder}
            onClose={() => { setShowEdit(false); setSelectedOrder(null); }}
            onSave={handleSaveEdit}
            onDelete={handleDeleteOrder}
          />
        )}
        */}
        {/* Stats Cards estilo dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Total Pedidos */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
            <div className="p-8 flex items-center justify-between min-h-[120px]">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Pedidos</p>
                <p className={`text-3xl font-bold transition-all duration-1000 ${animateStats ? 'scale-100' : 'scale-0'}`}>{counts.total}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 animate-bounce" />
              </div>
            </div>
          </div>
          {/* Pendientes */}
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-none shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
            <div className="p-8 flex items-center justify-between min-h-[120px]">
              <div>
                <p className="text-orange-100 text-sm font-medium">Pendientes</p>
                <p className={`text-3xl font-bold transition-all duration-1000 delay-200 ${animateStats ? 'scale-100' : 'scale-0'}`}>{counts.pendientes}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
            </div>
          </div>
          {/* Entregados */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white border-none shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
            <div className="p-8 flex items-center justify-between min-h-[120px]">
              <div>
                <p className="text-green-100 text-sm font-medium">Entregados</p>
                <p className={`text-3xl font-bold transition-all duration-1000 delay-400 ${animateStats ? 'scale-100' : 'scale-0'}`}>{counts.entregados}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 animate-pulse" />
              </div>
            </div>
          </div>
          {/* En Tránsito */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white border-none shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
            <div className="p-8 flex items-center justify-between min-h-[120px]">
              <div>
                <p className="text-purple-100 text-sm font-medium">En Tránsito</p>
                <p className={`text-3xl font-bold transition-all duration-1000 delay-600 ${animateStats ? 'scale-100' : 'scale-0'}`}>{counts.enTransito}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <div className="relative">
                  <Plane className="w-6 h-6 animate-bounce" style={{ animationDuration: '2s' }} />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-md p-8 mb-10 border border-gray-100">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Contenedor para búsqueda y filtros */}
            <div className="flex flex-nowrap items-center gap-2 w-auto sm:overflow-x-auto lg:overflow-visible">
              {/* Input de búsqueda */}
              <div className="relative min-w-[200px] max-w-[320px] w-[260px] flex-shrink-0">
                <input
                  type="text"
                  id="searchInput"
                  placeholder="Buscar por ID, usuario o pedido..."
                  className="search-input w-[320px] pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 flex-shrink-0"
                  onChange={(e) => setSearchTerm(e.target.value)}
                  value={searchTerm}
                />
                <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
              {/* Selects juntos con el mismo espacio */}
              <div className="flex gap-2 ml-16">
                {/* Select de estado animado */}
                <div className="w-[200px] min-w-[180px] max-w-[240px] flex-shrink-0">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[200px] flex-shrink-0">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent className="w-[200px]">
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="pedido-solicitado">Pedido Solicitado</SelectItem>
                      <SelectItem value="cotizacion-china">Cotización China</SelectItem>
                      <SelectItem value="cotizacion-venezuela">Cotización Venezuela</SelectItem>
                      <SelectItem value="cliente-paga">Cliente Paga</SelectItem>
                      <SelectItem value="validar-pago">Validar Pago</SelectItem>
                      <SelectItem value="re-empacar-china">Re-empacar China</SelectItem>
                      <SelectItem value="en-transito">En Tránsito</SelectItem>
                      <SelectItem value="almacen-venezuela">Almacén Venezuela</SelectItem>
                      <SelectItem value="entregado">Entregado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Select de transporte animado */}
                <div className="w-[200px] min-w-[180px] max-w-[240px] flex-shrink-0">
                  <Select value={transportFilter} onValueChange={setTransportFilter}>
                    <SelectTrigger className="w-[200px] flex-shrink-0">
                      <SelectValue placeholder="Todos los transportes" />
                    </SelectTrigger>
                    <SelectContent className="w-[200px]">
                      <SelectItem value="all">Todos los transportes</SelectItem>
                      <SelectItem value="Aéreo">Aéreo</SelectItem>
                      <SelectItem value="Marítimo">Marítimo</SelectItem>
                      <SelectItem value="Terrestre">Terrestre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {/* Botón de exportar */}
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2 w-full lg:w-auto lg:flex-shrink-0">
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* Tracking Table */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden w-full">
          <div className="px-4 py-6 border-b border-gray-200 w-full">
            <h2 className="text-2xl font-bold text-gray-900">Tracking Detallado de Pedidos</h2>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm md:text-base">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[120px] px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">ID Pedido</th>
                  <th className="w-[180px] px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
                  <th className="w-[220px] px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Pedido</th>
                  <th className="w-[120px] px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">Transporte</th>
                  <th className="w-[120px] px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="w-[100px] md:w-[120px] px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Días</th>
                  <th className="w-[140px] px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-all duration-200 cursor-pointer">
                    <td className="w-[120px] p-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{item.id}</div>
                      <div className="text-xs text-gray-500">{item.fecha}</div>
                    </td>
                    <td className="w-[180px] p-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-xs font-medium text-gray-600">{item.usuario.charAt(0)}</span>
                        </div>
                        <div className="font-medium text-gray-900 truncate">{item.usuario}</div>
                      </div>
                    </td>
                    <td className="w-[220px] p-4 max-w-sm truncate">
                      <div className="text-gray-900 truncate">{item.pedido}</div>
                    </td>
                    <td className="w-[120px] p-4 whitespace-nowrap align-middle text-center">
                      <div className="flex items-center justify-center gap-2">
                        <TransportGif transporte={item.transporte} />
                        <span className="text-gray-900 font-medium">{item.transporte}</span>
                      </div>
                    </td>
                    <td className="w-[120px] p-4 whitespace-nowrap">
                      <StatusBadge estado={item.estado} />
                    </td>
                    <td className="w-[120px] p-4 whitespace-nowrap hidden md:table-cell">
                      <div className="text-gray-900">
                        {item.diasRestantes > 0 ? `${item.diasRestantes} días` : 'Completado'}
                      </div>
                    </td>
                    <td className="w-[140px] p-4 whitespace-nowrap font-medium hidden md:table-cell">
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white/50 border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                          onClick={() => handleView(item)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(item)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteOrder(item.id)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default TrackingPanel;