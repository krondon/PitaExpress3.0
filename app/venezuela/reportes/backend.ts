
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export type MetricasPorPedido = {
  totalPedidos: number;
  entregados: number;
  enTransito: number;
  valorPromedio: number;
};

export async function getMetricasPorPedido(): Promise<MetricasPorPedido> {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('state');
  if (error || !orders) {
    return {
      totalPedidos: 0,
      entregados: 0,
      enTransito: 0,
      valorPromedio: 237, // valor fijo
    };
  }
  const totalPedidos = orders.length;
  const entregados = orders.filter((o: any) => o.state === 8).length;
  const enTransito = orders.filter((o: any) => [5, 6, 7].includes(o.state)).length;
  return {
    totalPedidos,
    entregados,
    enTransito,
    valorPromedio: 237, // valor fijo
  };
}
export async function getMetricasSatisfaccionCliente() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('reputation');
  if (error) throw error;

  const reputaciones = orders
    .map(o => o.reputation)
    .filter(r => r !== null && r !== undefined);
  const totalResenas = reputaciones.length;
  const promedioGeneral = totalResenas > 0
    ? reputaciones.reduce((acc, r) => acc + r, 0) / totalResenas
    : 0;
  const cincoEstrellas = reputaciones.filter(r => r === 5).length;
  const satisfechos = promedioGeneral > 0 ? Math.round((promedioGeneral / 5) * 100) : 0;

  return {
    promedioGeneral: Number(promedioGeneral.toFixed(2)),
    totalResenas,
    cincoEstrellas,
    satisfechos
  };
}

export async function getMetricasPorMes() {
  // Obtener todos los pedidos con fecha de creación
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, state, reputation, created_at');
  if (error) throw error;

  // Agrupar por mes
  const pedidosPorMes: Record<string, {
    id: number;
    mes: string;
    totalPedidos: number;
    completados: number;
    pendientes: number;
    satisfaccion: number;
    ingresos: number;
    fechaGeneracion: string;
    reputaciones: number[];
    primerPedido: Date;
    states: number[];
  }> = {};

  orders.forEach(order => {
    const fecha = new Date(order.created_at);
    const mes = fecha.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    if (!pedidosPorMes[mes]) {
      pedidosPorMes[mes] = {
        id: 0,
        mes,
        totalPedidos: 0,
        completados: 0,
        pendientes: 0,
        satisfaccion: 0,
        ingresos: 45250, // Temporal
        fechaGeneracion: fecha.toISOString().slice(0, 10),
        reputaciones: [],
        primerPedido: fecha,
        states: []
      };
    }
    pedidosPorMes[mes].totalPedidos++;
    pedidosPorMes[mes].states.push(order.state);
    if (order.state === 8) pedidosPorMes[mes].completados++;
    if ([1, 2, 3, 4].includes(order.state)) pedidosPorMes[mes].pendientes++;
    if (order.reputation !== null && order.reputation !== undefined) {
      pedidosPorMes[mes].reputaciones.push(order.reputation);
    }
    // Si la fecha es menor, actualizar primerPedido
    if (fecha < pedidosPorMes[mes].primerPedido) {
      pedidosPorMes[mes].primerPedido = fecha;
      pedidosPorMes[mes].fechaGeneracion = fecha.toISOString().slice(0, 10);
    }
  });

  // Formatear resultado como array
  const resultado = Object.entries(pedidosPorMes)
    .sort((a, b) => b[1].primerPedido.getTime() - a[1].primerPedido.getTime())
    .map(([mes, datos], idx) => ({
      id: idx + 1,
      mes: datos.mes,
      totalPedidos: datos.totalPedidos,
      completados: datos.completados,
      pendientes: datos.pendientes,
      satisfaccion: datos.reputaciones.length > 0 ? Number((datos.reputaciones.reduce((a, b) => a + b, 0) / datos.reputaciones.length).toFixed(2)) : 0,
      ingresos: datos.ingresos,
      fechaGeneracion: datos.fechaGeneracion,
      states: datos.states
    }));

  return resultado;
}

// Obtener meses únicos de la columna 'created_at' de la tabla 'orders'
export async function getMesesConPedidos() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('created_at');
  if (error) throw error;

  // Extraer meses únicos en formato 'YYYY-MM'
  const mesesSet = new Set();
  orders.forEach(order => {
    if (order.created_at) {
      const fecha = new Date(order.created_at);
      const mes = fecha.toISOString().slice(0, 7); // 'YYYY-MM'
      mesesSet.add(mes);
    }
  });
  return Array.from(mesesSet).sort();
}
// Reportes de satisfacción agrupados por mes
export async function getReportesSatisfaccionPorMes() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, reputation, created_at');
  if (error) throw error;

  // Agrupar por mes
  const reportesPorMes: Record<string, { reputaciones: number[], comentariosDestacados: string[] }> = {};
  orders.forEach(order => {
    if (!order.created_at) return;
    const fecha = new Date(order.created_at);
    const mes = fecha.toLocaleString('es-ES', { month: 'long', year: 'numeric' }); // Ej: "agosto 2025"
    if (!reportesPorMes[mes]) {
      reportesPorMes[mes] = { reputaciones: [], comentariosDestacados: [] };
    }
    if (order.reputation !== null && order.reputation !== undefined) {
      // Usar reputación original (sin redondear)
      reportesPorMes[mes].reputaciones.push(order.reputation);
    }
    // Aquí podrías agregar lógica para comentarios si tienes ese campo en la tabla
  });

  // Formatear resultado
  const resultado = Object.entries(reportesPorMes)
    .sort((a, b) => {
      // Ordenar por fecha (mes más reciente primero)
      const getDate = (mes: string) => {
        const [nombreMes, anio] = mes.split(' ');
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return new Date(parseInt(anio), meses.indexOf(nombreMes.toLowerCase()));
      };
      return getDate(b[0]).getTime() - getDate(a[0]).getTime();
    })
    .map(([periodo, datos], idx) => {
      const totalReseñas = datos.reputaciones.length;
      const promedioGeneral = totalReseñas > 0 ? Number((datos.reputaciones.reduce((a, b) => a + b, 0) / totalReseñas).toFixed(2)) : 0;
      const distribucion: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      datos.reputaciones.forEach(r => {
        // Agrupar por el entero más cercano para la gráfica
        const estrella = Math.round(r);
        if (distribucion[estrella] !== undefined) distribucion[estrella]++;
      });
      return {
        id: idx + 1,
        periodo,
        promedioGeneral,
        totalReseñas,
        distribucion,
        comentariosDestacados: [] // Si tienes comentarios, agrégalos aquí
      };
    });

  return resultado;
}

// Obtener lista de pedidos para el reporte por pedido
export async function getPedidosReportes() {
  // Obtener pedidos con client_id
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, client_id, state, reputation, created_at, productName');
  if (error) {
    console.error('Error al consultar pedidos:', error.message);
    return { error: 'No se pudo obtener los pedidos: ' + error.message, pedidos: [] };
  }
  if (!orders || orders.length === 0) {
    console.warn('No hay pedidos en la tabla orders');
    return { error: 'No hay pedidos registrados.', pedidos: [] };
  }

  // Obtener todos los clientes
  const { data: clients, error: errorClients } = await supabase
    .from('clients')
    .select('user_id, name');
  if (errorClients) {
    console.error('Error al consultar clientes:', errorClients.message);
    return { error: 'No se pudo obtener los clientes: ' + errorClients.message, pedidos: [] };
  }
  if (!clients) {
    console.warn('No hay clientes en la tabla clients');
    return { error: 'No hay clientes registrados.', pedidos: [] };
  }

  // Mapear estados a texto
  const estadosMap: Record<number, string> = {
    5: 'EN TRANSITO',
    6: 'EN TRANSITO',
    7: 'EN TRANSITO',
    1: 'PENDIENTE',
    2: 'PENDIENTE',
    3: 'PENDIENTE',
    4: 'PENDIENTE',
  };

  // Valor fijo para ingresos
  const ingresoFijo = 250;

  const pedidos = orders.map((order: any) => {
    // Buscar nombre del cliente
    const clienteObj = clients.find((c: any) => c.user_id === order.client_id);
    const nombreCliente = clienteObj ? clienteObj.name : 'Sin Cliente';
    return {
      id: order.id,
      numeroPedido: `PED-${order.id}`,
      cliente: nombreCliente,
      estado: estadosMap[order.state] || 'DESCONOCIDO',
      valor: ingresoFijo,
      satisfaccion: order.reputation !== null && order.reputation !== undefined ? order.reputation : null,
      fechaPedido: order.created_at ? new Date(order.created_at).toISOString().slice(0, 10) : '',
      productName: order.productName || '',
    };
  });

  return { error: null, pedidos };
}
