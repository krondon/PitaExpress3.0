# Migraciones de Base de Datos

## Tabla: api_health_logs

Esta migración crea la tabla necesaria para el sistema de monitoreo de APIs de tasas de cambio.

### Instrucciones

1. Abre el SQL Editor en tu panel de Supabase
2. Copia y pega el contenido del archivo `create_api_health_logs.sql`
3. Ejecuta el script

O alternativamente, si tienes la CLI de Supabase configurada:

```bash
supabase db push
```

### Descripción

La tabla `api_health_logs` almacena:
- Intentos de conexión a APIs externas
- Tiempos de respuesta
- Errores encontrados
- Tasas de cambio obtenidas

Esta información se utiliza para:
- Monitorear el estado de las APIs
- Calcular estadísticas de disponibilidad
- Identificar problemas de conectividad
- Mostrar métricas en el panel de administración

