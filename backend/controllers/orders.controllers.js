// Imports
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Coupon from "../models/Coupon.js"; // NUEVO: Importamos el modelo de Cupones

export const createOrder = async (req, res) => {
    try {
        // NUEVO: Agregamos couponCode para recibir el texto del cupón desde el frontend
        const { products, shippingAddress, shippingCost, couponCode } = req.body;
        const userId = req.user.id;

        let totalAmount = 0;
        let totalEarnedPoints = 0;
        const orderProducts = [];

        // El cajero revisa el producto.
        for (let item of products) {
            const productFound = await Product.findById(item.product);

            if(!productFound){
                return res.status(404).json({ message: "Un producto de tu carrito no existe" });
            }

            // Tengo stock en el deposito?
            if(productFound.stock < item.quantity){
                return res.status(400).json({ message: `No hay stock suficiente para ${productFound.name}.` });
            }

            // Precio por cantidad
            totalAmount += productFound.price * item.quantity;

            // Calculo cuantos puntos de Onda Basquete Club se gana
            totalEarnedPoints += (productFound.earnedPoints || 0) * item.quantity;

            // Resto el stock del deposito
            productFound.stock -= item.quantity;
            await productFound.save();

            // Anoto el producto en el recibo(congelo el precio).
            orderProducts.push({
                product: productFound._id,
                quantity: item.quantity,
                price: productFound.price
            });
        }

        // Sumo el costo del correo al total a pagar.
        totalAmount += (shippingCost || 0);

        // Imprimo el recibo
        const newOrder = new Order({
            user: userId,
            products: orderProducts,
            shippingAddress,
            shippingCost: shippingCost || 0,
            totalAmount
        });

        const savedOrder = await newOrder.save();

        // Pongo los puntos de premio por la compra al perfil del usuario.
        const userFound = await User.findById(userId);
        userFound.points += totalEarnedPoints;
        await userFound.save();

        // ==========================================
        // NUEVO: LÓGICA DE CUPÓN DE UN SOLO USO
        // ==========================================
        if (couponCode) {
            // Buscamos el cupón que el usuario ingresó
            const couponUsed = await Coupon.findOne({ code: couponCode.toUpperCase() });
            
            // Si el cupón existe y el usuario aún no está en la lista de usedBy, lo agregamos
            if (couponUsed && !couponUsed.usedBy.includes(userId)) {
                couponUsed.usedBy.push(userId);
                await couponUsed.save();
            }
        }

        res.status(201).json({
            message: "¡Orden creada con éxito! Tu paquete se preparará pronto.",
            order: savedOrder,
            pointsEarned: totalEarnedPoints 
        });
    } catch (error) {
        console.log("Error al crear orden:", error.message);
        res.status(500).json({ message: "Error interno al procesar la compra." });
    }
};

// Funcion que hace que el cliente vea sus propias cuentas.
export const getMyOrders = async (req, res) => {
    try {
        // Busco todas las ordenes donde el usuario sea quien está logueado
        const orders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener tus pedidos." });
    }
};

// Funcion para que el admin vea todos los pedidos de la tienda.
export const getAllOrders = async (req, res) => {
    try {
        // Busco todas las ordenes y traigo los datos del usuario que compró.
        const orders = await Order.find().populate("user", "name email").sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener todos los pedidos." });
    }
};

// Funcion para que el admin agregue el estado a las compras (pendiente, enviado, etc)
export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, trackingCode } = req.body;

        // Buscamos la orden original
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: "Orden no encontrada." });
        }

        // Si se marca como "Cancelado" y antes no lo estaba, devolvemos el stock
        if (status === "Cancelado" && order.status !== "Cancelado") {
            for (let item of order.products) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock += item.quantity;
                    await product.save();
                }
            }
        }

        // Actualizamos los datos y guardamos
        order.status = status;
        order.trackingCode = trackingCode;
        const updatedOrder = await order.save();

        res.status(200).json({ message: "Estado de orden actualizado con éxito.", order: updatedOrder });
    } catch (error) {
        console.log("Error al actualizar estado:", error.message);
        res.status(500).json({ message: "Error al actualizar estado." });
    }
};

// Funcion para que el admin elimine un pedido de la base de datos
export const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Buscamos la orden
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: "Pedido no encontrado." });
        }

        // Solo devolvemos el stock si la orden NO estaba cancelada previamente
        if (order.status !== "Cancelado") {
            for (let item of order.products) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock += item.quantity;
                    await product.save();
                }
            }
        }

        // Eliminamos la orden permanentemente
        await Order.findByIdAndDelete(id);
        
        res.status(200).json({ message: "Pedido eliminado de la base de datos." });
    } catch (error) {
        console.log("Error al eliminar pedido:", error.message);
        res.status(500).json({ message: "Error interno al eliminar el pedido." });
    }
};