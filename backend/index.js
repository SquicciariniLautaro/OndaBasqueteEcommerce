// Imports de archivos
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import homeRoutes from './routes/home.routes.js';
import productsRoutes from './routes/products.routes.js';
import fileUpload from 'express-fileupload';
import { connectDB } from './config/db.js';
import usersRoutes from "./routes/users.routes.js";
import "./config/mailer.js";
import couponsRoutes from './routes/coupons.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import shippingRoutes from './routes/shipping.routes.js'; // NUEVA IMPORTACIÓN
import cors from "cors";
import reviewsRoutes from './routes/reviews.routes.js';
import errorHandler from './middleware/errorHandler.js';

// Constantes
const app = express();

// Seguridad
app.use(helmet()); // Protege las cabeceras HTTP

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limita cada IP a 100 peticiones por ventana
    message: "Demasiadas peticiones desde esta IP, por favor intenta de nuevo en 15 minutos."
});
app.use('/api/', limiter); // Aplicamos el limitador a las rutas de la API

// Configuración de CORS estricta para producción y desarrollo local
const allowedOrigins = [
    process.env.FRONTEND_URL, // Tu futuro dominio en Hostinger (Ej: https://ondabasquete.com)
    'http://localhost:5173'   // Tu entorno de desarrollo local Vite
];

const corsOptions = {
    origin: function (origin, callback) {
        // Permite peticiones sin origen (como las del propio servidor) o las que estén en la lista blanca
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por CORS: Origen no autorizado'));
        }
    },
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());

app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: './tmp/'
}));

app.use('/', homeRoutes);
app.use('/api/products', productsRoutes);
app.use("/api/users", usersRoutes);
app.use('/api/orders', ordersRoutes); 
app.use('/api/coupons', couponsRoutes);
app.use('/api/reviews', reviewsRoutes);

// Calculador de envíos
app.use('/api/shipping', shippingRoutes);

// Manejo centralizado de errores (Debe ir después de todas las rutas)
app.use(errorHandler);

const port = process.env.PORT || 3001;

// Evento de app
connectDB();

app.listen(port, () => {
    console.log(`Servidor de Onda Basquete encendido en el puerto ${port}`);
});