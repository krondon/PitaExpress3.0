// Script rápido para simular el avance de estado de un pedido y disparar notificaciones reales.
// Uso: node scripts/simulate-order.js <ID_DEL_PEDIDO> <NUEVO_ESTADO>
// Ejemplo: node scripts/simulate-order.js 44 9
const id = process.argv[2];
const estado = parseInt(process.argv[3]);

if (!id || isNaN(estado)) {
    console.log("Uso: node scripts/simulate-order.js <ID_DEL_PEDIDO> <NUEVO_ESTADO>");
    process.exit();
}

async function simular() {
    const url = `http://localhost:3000/api/orders/${id}/state`;
    console.log(`📡 Llamando a: PUT ${url} con estado ${estado}...`);

    try {
        const res = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                state: estado,
                changed_by: "Prueba desde Terminal",
                notes: "Simulando notificaciones",
            }),
        });
        const result = await res.json();
        console.log("✅ Respuesta de la API:", result);
    } catch (error) {
        console.log("❌ Error:", error);
    }
}

simular();
