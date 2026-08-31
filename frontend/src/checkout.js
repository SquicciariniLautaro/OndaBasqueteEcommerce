import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import Swal from 'sweetalert2';
import './style.css';

const token = localStorage.getItem('token');
const cart = JSON.parse(localStorage.getItem('cart')) || [];

// VARIABLES GLOBALES PARA LA MATEMÁTICA
let subtotalAmount = 0;
let discountAmount = 0; 
let finalTotalAmount = 0;
let userPoints = 0;
let pointsToDeduct = 0;

if (!token) {
    Swal.fire({
        title: 'Inicia sesión', text: 'Debes ingresar a tu cuenta para poder comprar.', icon: 'warning', confirmButtonColor: '#000000'
    }).then(() => {
        localStorage.setItem('redirectAfterLogin', '/checkout.html');
        window.location.href = '/login.html';
    });
} else if (cart.length === 0) {
    window.location.href = '/cart.html';
} else {
    document.getElementById('submit-order-btn').disabled = false;
    loadUserData();
    renderCheckoutSummary();
}

async function loadUserData() {
    try {
        const response = await fetch('http://localhost:3001/api/users/profile', {
            headers: { 'auth-token': token }
        });
        const data = await response.json();
        if (response.ok) {
            userPoints = data.points || 0;
            document.getElementById('coupon-message').innerText = `Tienes ${userPoints} puntos disponibles.`;
            document.getElementById('coupon-message').classList.add('text-muted');
        }
    } catch (error) {
        console.log("No se pudieron cargar los puntos del usuario.");
    }
}

function renderCheckoutSummary() {
    const listContainer = document.getElementById('checkout-items-list');
    let html = '';
    subtotalAmount = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotalAmount += itemTotal;
        html += `
            <div class="d-flex align-items-center mb-3">
                <img src="${item.image}" alt="${item.model}" class="img-fluid rounded border p-1 me-3" style="width: 60px; height: 60px; object-fit: contain;">
                <div class="flex-grow-1">
                    <h6 class="fw-bold mb-0" style="font-size: 0.9rem;">${item.model}</h6>
                    <small class="text-muted d-block">Talle: ${item.size} | Cant: ${item.quantity}</small>
                </div>
                <span class="fw-bold" style="font-size: 0.9rem;">$${itemTotal.toLocaleString('es-AR')}</span>
            </div>
        `;
    });

    listContainer.innerHTML = html;
    updateTotalsDisplay(); 
}

function updateTotalsDisplay() {
    // Matemática simple: subtotal menos descuentos (el envío ya no suma aquí)
    finalTotalAmount = subtotalAmount - discountAmount;

    document.getElementById('checkout-subtotal').innerText = `$${subtotalAmount.toLocaleString('es-AR')}`;
    document.getElementById('checkout-total').innerText = `$${finalTotalAmount.toLocaleString('es-AR')}`;
    
    const discountRow = document.getElementById('discount-row');
    if (discountAmount > 0) {
        discountRow.classList.remove('d-none');
        document.getElementById('checkout-discount').innerText = `-$${discountAmount.toLocaleString('es-AR')}`;
    } else {
        discountRow.classList.add('d-none');
    }
}

document.getElementById('btn-apply-coupon').addEventListener('click', async () => {
    const codeInput = document.getElementById('coupon-input').value.trim();
    const msgLabel = document.getElementById('coupon-message');

    if (!codeInput) return Swal.fire('Atención', 'Escribe un código primero.', 'warning');

    try {
        const response = await fetch('http://localhost:3001/api/coupons/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'auth-token': token },
            body: JSON.stringify({ code: codeInput })
        });
        const data = await response.json();

        if (response.ok) {
            if (userPoints < data.pointsRequired) {
                msgLabel.className = 'd-block mt-2 fw-bold text-danger';
                msgLabel.innerText = `Necesitas ${data.pointsRequired} pts (Tienes ${userPoints}).`;
                return;
            }

            discountAmount = subtotalAmount * (data.discountPercentage / 100);
            pointsToDeduct = data.pointsRequired; 
            updateTotalsDisplay(); 
            
            msgLabel.className = 'd-block mt-2 fw-bold text-success';
            msgLabel.innerText = `¡Cupón de ${data.discountPercentage}% aplicado!`;
            document.getElementById('coupon-input').disabled = true;
            document.getElementById('btn-apply-coupon').disabled = true;
        } else {
            msgLabel.className = 'd-block mt-2 fw-bold text-danger';
            msgLabel.innerText = data.message;
        }
    } catch (error) {}
});

// PROCESAR ORDEN Y ENVIAR WSP
const checkoutForm = document.getElementById('checkout-form');
if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('submit-order-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Armando pedido...';

        const orderProducts = cart.map(item => ({ product: item.id, quantity: item.quantity, price: item.price }));

        // EXTRAEMOS EL NOMBRE Y DNI QUE EL CLIENTE ESCRIBIÓ EN EL HTML
        const fullName = document.getElementById('fullName').value.trim();
        const dni = document.getElementById('dni').value.trim();

        const orderData = {
            products: orderProducts,
            shippingAddress: {
                street: document.getElementById('street').value.trim(),
                number: document.getElementById('number').value.trim(),
                city: document.getElementById('city').value.trim(),
                province: document.getElementById('province').value,
                zipCode: document.getElementById('zipCode').value.trim()
            },
            shippingCost: 0, 
            pointsToUse: pointsToDeduct,
            couponCode: document.getElementById('coupon-input').value.trim()
        };

        try {
            const response = await fetch('http://localhost:3001/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'auth-token': token },
                body: JSON.stringify(orderData)
            });

            const data = await response.json();

            if (response.ok) {
                const phoneNumber = "5493885759258"; 
                
                let wspText = `*¡Hola Onda Basquete! Acabo de realizar un pedido.*\n`;
                wspText += `Identificador: #${data.orderId || Math.floor(Math.random() * 10000)}\n\n`;
                
                // INYECTAMOS EL NOMBRE Y DNI EN EL MENSAJE
                wspText += `👤 *Cliente:* ${fullName}\n`;
                wspText += `🆔 *DNI:* ${dni}\n\n`;

                wspText += `*Detalles de mi orden:*\n`;
                
                cart.forEach(item => {
                    wspText += `📦 ${item.model} (Talle: ${item.size}) - Cant: ${item.quantity} - $${(item.price * item.quantity).toLocaleString('es-AR')}\n`;
                });

                wspText += `\n📍 *Mis datos para el envío:*\n`;
                wspText += `${orderData.shippingAddress.street} ${orderData.shippingAddress.number}, ${orderData.shippingAddress.city}, ${orderData.shippingAddress.province} (CP: ${orderData.shippingAddress.zipCode})\n\n`;
                
                if (discountAmount > 0) {
                    wspText += `🎟️ *Descuento:* -$${discountAmount.toLocaleString('es-AR')}\n`;
                }
                
                wspText += `💰 *TOTAL DE PRODUCTOS: $${finalTotalAmount.toLocaleString('es-AR')}*\n\n`;
                wspText += `_Quedo a la espera de que coordinemos el método/costo de envío y me pasen los datos para transferir._ ¡Gracias!`;

                const encodedText = encodeURIComponent(wspText);
                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedText}`;

                localStorage.removeItem('cart');
                
                Swal.fire({
                    title: '¡Pedido Confirmado!',
                    text: 'Te redirigiremos a WhatsApp para coordinar el envío y el pago.',
                    icon: 'success',
                    confirmButtonColor: '#000000',
                    allowOutsideClick: false
                }).then(() => {
                    window.open(whatsappUrl, '_blank'); 
                    window.location.href = '/index.html'; 
                });
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Confirmar Pedido por WhatsApp';
        }
    });
}