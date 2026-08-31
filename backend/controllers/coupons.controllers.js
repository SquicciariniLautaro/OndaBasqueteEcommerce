import Coupon from "../models/Coupon.js";
import User from "../models/User.js";
import { transporter } from "../config/mailer.js";

// Funcion para que el dueño pueda crear nuevos cupones.
export const createCoupon = async (req, res) => {
    try{
        const { code, discountPercentage, pointsRequired } = req.body;

        const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
        if(existingCoupon){
            return res.status(400).json({ message: "¡Ese código de cupón ya existe!" });
        }

        const newCoupon = new Coupon({
            code,
            discountPercentage,
            pointsRequired
        });

        const savedCoupon = await newCoupon.save();

        res.status(201).json({ 
            message: "¡Cupón creado con éxito para Onda Basquete Club",
            coupon: savedCoupon
        });
    }catch (error){
        console.log("Error al crear cupón", error.message);
        res.status(500).json({ message: "Error interno al crear cupón." });
    }
};

// Funcion para que los dueños activen o desactiven los cupones.
export const toggleCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const couponFound = await Coupon.findById(id);
        
        if(!couponFound){
            return res.status(404).json({ message: "Cupón no encontrado." });
        }

        couponFound.isActive = !couponFound.isActive;
        await couponFound.save();

        res.status(200).json({ 
            message: `El cupón ahora está ${couponFound.isActive ? 'ACTIVADO' : 'DESACTIVADO'}`,
            coupon: couponFound
        });
    } catch (error) {
        console.log("Error al actualizar cupón:", error.message);
        res.status(500).json({ message: "Error interno al actualizar cupón." });
    }
};

// Funcion para que el dueño envie un correo electronico masivo con codigo de descuento.
export const sendPromoEmail = async (req, res) => {
    try {
        const { title, message, discountCode } = req.body;
        const upperCode = discountCode.toUpperCase();

        // NUEVO: Verificamos si el cupón ya existe en la base de datos
        let couponFound = await Coupon.findOne({ code: upperCode });

        // Si no existe, lo creamos automáticamente antes de enviar el correo
        if (!couponFound) {
            const newPromoCoupon = new Coupon({
                code: upperCode,
                discountPercentage: 15, // Porcentaje por defecto para regalos (puedes cambiarlo)
                pointsRequired: 0       // Es un regalo, no pide puntos
            });
            await newPromoCoupon.save();
        }

        const allUsers = await User.find();

        for (let user of allUsers) {
            await transporter.sendMail({
                from: `"Onda Basquete" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: `${title}`,
                html: `
                    <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                        <h2>¡Hola ${user.name}!</h2>
                        <p>${message}</p>
                        <div style="background-color: #f4f4f4; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 16px;">Tu código de regalo es:</p>
                            <h1 style="color: #fca311; letter-spacing: 2px; margin: 10px 0;">${upperCode}</h1>
                        </div>
                        <p>¡Te esperamos en la tienda!</p>
                    </div>
                `
            });
        };

        res.status(200).json({ message: "¡Correos enviados y cupón registrado en la base de datos!" });
    } catch (error) {
        console.log("Error al enviar promociones:", error.message);
        res.status(500).json({ message: "Error interno del servidor al enviar los correos."});
    }
};

// Función para que el cliente valide un cupón en el checkout
export const validateCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        
        // Dependiendo de tu archivo verifyToken, el ID del usuario viene en req.userId o req.user.id
        // Asumimos req.userId o req.user.id
        const userId = req.userId || (req.user && req.user.id) || (req.user && req.user._id);
        
        const couponFound = await Coupon.findOne({ code: code.toUpperCase() });
        
        if (!couponFound) {
            return res.status(404).json({ message: "El cupón no existe o está mal escrito." });
        }

        if (!couponFound.isActive) {
            return res.status(400).json({ message: "Este cupón ya ha expirado o está desactivado." });
        }

        // NUEVO: Validación de un solo uso
        if (userId && couponFound.usedBy.includes(userId)) {
            return res.status(400).json({ message: "Ya has utilizado este cupón en una compra anterior." });
        }

        res.status(200).json(couponFound);
    } catch (error) {
        console.log("Error al validar cupón:", error.message);
        res.status(500).json({ message: "Error interno al validar el cupón." });
    }
};

// Función para que el admin vea todos los cupones creados
export const getAllCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
        res.status(200).json(coupons);
    } catch (error) {
        console.log("Error al obtener cupones:", error.message);
        res.status(500).json({ message: "Error interno al obtener los cupones." });
    }
};

// Función para que el admin elimine un cupón
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCoupon = await Coupon.findByIdAndDelete(id);
        
        if (!deletedCoupon) {
            return res.status(404).json({ message: "Cupón no encontrado." });
        }
        res.status(200).json({ message: "Cupón eliminado con éxito." });
    } catch (error) {
        console.log("Error al eliminar cupón:", error.message);
        res.status(500).json({ message: "Error interno al eliminar el cupón." });
    }
};