import "dotenv/config"


export const config = {
    PORT: process.env.PORT,
    provider: process.env.provider,
    groq_apikey: process.env.GROQ_API_KEY,
    openrouter_apikey: process.env.OPENROUTER_API_KEY,
    direccionGoogleMaps:process.env.DIRECCION_GOOGLE_MAPS,

    //Base de datos
    mongoDb_uri: process.env.MONGO_URI,

    googleScriptUrl: process.env.GOOGLE_SCRIPT_URL || '',
    timezone: 'America/La_Paz',
    workingHours: {
        start: 8,
        end: 18
    },
    timeAdvance: 60,

    // Enlaces de Google Maps
direccionGoogleMapsSucursal1: "https://maps.app.goo.gl/q9uhif8JfxPw91ry6",
direccionGoogleMapsSucursal2: "https://maps.app.goo.gl/7gp4adyNppsJoEab6",

// Coordenadas de las sucursales
sucursal1Lat: -16.5030766, // Ejemplo
sucursal1Lon: -68.1447576,
sucursal2Lat: -16.5039324,
sucursal2Lon: -68.1322785,

// Direcciones legibles
direccionSucursal1: "Av. Principal 123, Centro",
direccionSucursal2: "Calle Norte 456, Zona Norte",
}