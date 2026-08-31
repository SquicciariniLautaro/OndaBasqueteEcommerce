import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import Swal from 'sweetalert2';
import './style.css';

const token = localStorage.getItem('token');
const userRole = localStorage.getItem('userRole');

if (!token || (userRole !== 'administrador' && userRole !== 'admin')) {
    window.location.href = '/index.html';
}

const productForm = document.getElementById('product-form');
const tableBody = document.getElementById('admin-table-body');
const editIdInput = document.getElementById('edit-id');
const sizesContainer = document.getElementById('sizes-container');
const addSizeBtn = document.getElementById('add-size-btn');

// El input de talle ahora es de tipo 'text' para permitir S, M, L o Único
const createSizeRow = (size = '', stock = '') => {
    const row = document.createElement('div');
    row.className = 'row mb-2 size-row';
    row.innerHTML = `
        <div class="col-5"><input type="text" class="form-control size-input shadow-none bg-light border-0" placeholder="Talle (Ej: 40 o L)" value="${size}" required></div>
        <div class="col-5"><input type="number" class="form-control stock-input shadow-none bg-light border-0" placeholder="Cantidad" value="${stock}" required></div>
        <div class="col-2"><button type="button" class="btn btn-danger w-100 remove-size-btn fw-bold shadow-none">X</button></div>
    `;
    row.querySelector('.remove-size-btn').addEventListener('click', () => row.remove());
    sizesContainer.appendChild(row);
};

createSizeRow();
addSizeBtn.addEventListener('click', () => createSizeRow());

const loadInventory = async () => {
    try {
        const response = await fetch('http://localhost:3001/api/products?limit=50');
        const data = await response.json();
        
        tableBody.innerHTML = '';
        if (!data.results || data.results.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No hay productos.</td></tr>';
            return;
        }

        data.results.forEach(product => {
            const priceHtml = product.discount > 0 
                ? `<span class="text-danger text-decoration-line-through small">$${product.price}</span> <br> <span class="fw-bold text-success">$${product.price - (product.price * (product.discount/100))}</span>`
                : `<span class="fw-bold">$${product.price}</span>`;

            const mainImg = (product.images && product.images.length > 0) ? product.images[0] : product.image;
            
            // UI ACTUALIZADA: Usamos btn-dark para destacado y btn-outline-dark para no destacado
            const starClass = product.isFeatured ? 'btn-dark' : 'btn-outline-dark';
            const starText = product.isFeatured ? 'Destacado' : 'Destacar';

            tableBody.innerHTML += `
                <tr>
                    <td class="px-4"><img src="${mainImg}" alt="img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;"></td>
                    <td>
                        <span class="fw-bold d-block">${product.model}</span>
                        <span class="small text-muted">${product.brand} | ${product.category || 'Zapatillas'}</span>
                    </td>
                    <td><span class="badge bg-secondary">${product.stock || 0} u. total</span></td>
                    <td>${priceHtml}</td>
                    <td class="text-center px-4">
                        <button class="btn btn-sm ${starClass} me-1 fw-bold" onclick="toggleFeatured('${product._id}')">${starText}</button>
                        <!-- UI ACTUALIZADA: Botón Editar ahora es negro transparente -->
                        <button class="btn btn-sm btn-outline-dark me-1 fw-bold" onclick='editProduct(${JSON.stringify(product).replace(/'/g, "&apos;")})'>EDITAR</button>
                        <!-- Se mantiene rojo para Eliminar -->
                        <button class="btn btn-sm btn-danger fw-bold" onclick="deleteProduct('${product._id}')">ELIMINAR</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) { console.error(error); }
};

window.toggleFeatured = async (id) => {
    try {
        const response = await fetch(`http://localhost:3001/api/products/${id}/feature`, { method: 'PUT', headers: { 'auth-token': token } });
        if (response.ok) { loadInventory(); } else { Swal.fire('Error', 'No se pudo actualizar.', 'error'); }
    } catch (error) { Swal.fire('Error', 'Error de conexión.', 'error'); }
};

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEditingId = editIdInput.value;
    Swal.fire({ title: 'Subiendo a la nube...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const formData = new FormData();
        formData.append('model', document.getElementById('name').value);
        formData.append('brand', document.getElementById('brand').value);
        formData.append('category', document.getElementById('category').value);
        formData.append('price', document.getElementById('price').value);
        formData.append('discount', document.getElementById('discount').value || 0);
        formData.append('earnedPoints', document.getElementById('earnedPoints').value || 0);
        
        const sizesList = [];
        document.querySelectorAll('.size-row').forEach(row => {
            const s = row.querySelector('.size-input').value;
            const q = row.querySelector('.stock-input').value;
            if(s && q) sizesList.push({ size: String(s), stock: Number(q) });
        });
        formData.append('sizes', JSON.stringify(sizesList));
        
        const imageFiles = document.getElementById('images').files;
        for(let i = 0; i < imageFiles.length; i++){ formData.append('images', imageFiles[i]); }

        const url = isEditingId ? `http://localhost:3001/api/products/${isEditingId}` : 'http://localhost:3001/api/products';
        const method = isEditingId ? 'PUT' : 'POST';

        const response = await fetch(url, { method: method, headers: { 'auth-token': token }, body: formData });
        const data = await response.json();
        if (response.ok) {
            Swal.fire('¡Éxito!', 'Operación completada', 'success');
            productForm.reset();
            sizesContainer.innerHTML = '';
            createSizeRow();
            editIdInput.value = '';
            document.getElementById('form-title').innerText = 'Subir Nuevo Producto';
            document.getElementById('submit-btn').innerText = 'Publicar Producto';
            document.getElementById('cancel-edit-btn').classList.add('d-none');
            loadInventory();
        } else throw new Error(data.message);
    } catch (error) { Swal.fire('Error', error.message, 'error'); }
});

window.editProduct = (product) => {
    editIdInput.value = product._id;
    document.getElementById('name').value = product.model;
    document.getElementById('brand').value = product.brand;
    document.getElementById('category').value = product.category || 'Zapatillas';
    document.getElementById('price').value = product.price;
    document.getElementById('discount').value = product.discount || 0;
    document.getElementById('earnedPoints').value = product.earnedPoints || 0;
    
    sizesContainer.innerHTML = '';
    if(product.sizes && product.sizes.length > 0){
        product.sizes.forEach(s => createSizeRow(s.size, s.stock));
    } else { createSizeRow(); }
    
    document.getElementById('form-title').innerText = `Editando: ${product.model}`;
    document.getElementById('submit-btn').innerText = 'Actualizar Producto';
    document.getElementById('cancel-edit-btn').classList.remove('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    productForm.reset();
    sizesContainer.innerHTML = '';
    createSizeRow();
    editIdInput.value = '';
    document.getElementById('form-title').innerText = 'Subir Nuevo Producto';
    document.getElementById('submit-btn').innerText = 'Publicar Producto';
    document.getElementById('cancel-edit-btn').classList.add('d-none');
});

window.deleteProduct = (id) => {
    Swal.fire({
        title: '¿Eliminar producto?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#e63946', confirmButtonText: 'Sí, borrar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await fetch(`http://localhost:3001/api/products/${id}`, { method: 'DELETE', headers: { 'auth-token': token }});
            Swal.fire('Eliminado', '', 'success');
            loadInventory();
        }
    });
};

const loadCoupons = async () => {
    const tbody = document.getElementById('admin-coupons-list');
    if (!tbody) return;
    try {
        const response = await fetch('http://localhost:3001/api/coupons', { headers: { 'auth-token': token } });
        const data = await response.json();
        if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No hay cupones creados.</td></tr>'; return; }
        tbody.innerHTML = data.map(c => `
            <tr>
                <td class="px-3"><span class="fw-bold text-dark">${c.code}</span><br><span class="text-muted" style="font-size: 0.75rem;">Req: ${c.pointsRequired} pts</span></td>
                <td><span class="fw-bold text-dark">-${c.discountPercentage}%</span><br><span class="badge ${c.isActive ? 'bg-dark' : 'bg-secondary'}" style="font-size: 0.65rem;">${c.isActive ? 'Activo' : 'Apagado'}</span></td>
                <td class="text-center px-3">
                    <!-- UI ACTUALIZADA: Botones oscuros y minimalistas -->
                    <button class="btn btn-sm ${c.isActive ? 'btn-dark' : 'btn-outline-dark'} w-100 mb-1 fw-bold" style="font-size: 0.75rem;" onclick="toggleCouponStatus('${c._id}')">${c.isActive ? 'Apagar' : 'Encender'}</button>
                    <!-- Se mantiene rojo para Borrar -->
                    <button class="btn btn-sm btn-danger w-100 fw-bold" style="font-size: 0.75rem;" onclick="deleteCouponAdmin('${c._id}')">Borrar</button>
                </td>
            </tr>
        `).join('');
    } catch (error) { tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger py-4">Error.</td></tr>'; }
};

window.toggleCouponStatus = async (id) => {
    try {
        const response = await fetch(`http://localhost:3001/api/coupons/${id}`, { method: 'PUT', headers: { 'auth-token': token } });
        if(response.ok) loadCoupons();
    } catch (error) {}
};

window.deleteCouponAdmin = async (id) => {
    Swal.fire({
        title: '¿Borrar cupón?', text: "Nadie podrá usar este código.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Sí, borrar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`http://localhost:3001/api/coupons/${id}`, { method: 'DELETE', headers: { 'auth-token': token } });
                if (response.ok) { Swal.fire('Borrado', 'Eliminado.', 'success'); loadCoupons(); }
            } catch (error) {}
        }
    });
};

document.getElementById('coupon-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const bodyData = { code: document.getElementById('coupon-code').value, discountPercentage: document.getElementById('coupon-discount').value, pointsRequired: document.getElementById('coupon-points').value || 0 };
        const response = await fetch('http://localhost:3001/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json', 'auth-token': token }, body: JSON.stringify(bodyData) });
        const data = await response.json();
        if(response.ok) {
            Swal.fire('Cupón Creado', data.message, 'success');
            document.getElementById('coupon-form').reset();
            loadCoupons(); 
        } else throw new Error(data.message);
    } catch (error) { Swal.fire('Error', error.message, 'error'); }
});

document.getElementById('promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    Swal.fire({ title: 'Enviando correos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        const bodyData = { title: document.getElementById('promo-title').value, message: document.getElementById('promo-message').value, discountCode: document.getElementById('promo-code').value };
        
        // CORRECCIÓN DEL 404: Cambiamos /promo a /send-promo para que coincida con el backend
        const response = await fetch('http://localhost:3001/api/coupons/send-promo', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'auth-token': token }, 
            body: JSON.stringify(bodyData) 
        });
        
        const data = await response.json();
        if(response.ok) {
            Swal.fire('¡Enviado!', data.message, 'success');
            document.getElementById('promo-form').reset();
        } else throw new Error(data.message);
    } catch (error) { Swal.fire('Error', error.message, 'error'); }
});

// GESTIÓN DE RESEÑAS
const loadReviews = async () => {
    const tbody = document.getElementById('admin-reviews-list');
    if (!tbody) return;
    try {
        const response = await fetch('http://localhost:3001/api/reviews');
        const data = await response.json();
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td class="text-center text-muted py-4">No hay reseñas activas.</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(r => `
            <tr>
                <td style="width: 60px;" class="px-3">
                    <img src="${r.image}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover;">
                </td>
                <td>
                    <span class="fw-bold d-block text-dark">${r.clientName}</span>
                    <span class="text-muted" style="font-size: 0.8rem;">${r.clientRole}</span>
                </td>
                <td class="text-end px-3">
                    <!-- Se mantiene rojo para Eliminar -->
                    <button class="btn btn-sm btn-danger fw-bold px-3" onclick="deleteReview('${r._id}')">Eliminar</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = '<tr><td class="text-center text-danger py-4">Error al cargar.</td></tr>';
    }
};

window.deleteReview = async (id) => {
    Swal.fire({
        title: '¿Borrar reseña?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Sí, borrar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`http://localhost:3001/api/reviews/${id}`, { method: 'DELETE', headers: { 'auth-token': token } });
                if (response.ok) { Swal.fire('Borrado', 'Reseña eliminada.', 'success'); loadReviews(); }
            } catch (error) {}
        }
    });
};

const reviewForm = document.getElementById('review-form');
if(reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        Swal.fire({ title: 'Subiendo reseña...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const formData = new FormData();
            formData.append('clientName', document.getElementById('review-name').value);
            formData.append('clientRole', document.getElementById('review-role').value);
            formData.append('message', document.getElementById('review-message').value);
            formData.append('image', document.getElementById('review-image').files[0]);

            const response = await fetch('http://localhost:3001/api/reviews', {
                method: 'POST',
                headers: { 'auth-token': token },
                body: formData
            });

            const data = await response.json();
            if(response.ok) {
                Swal.fire('¡Éxito!', data.message, 'success');
                reviewForm.reset();
                loadReviews();
            } else throw new Error(data.message);
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        }
    });
}

// GESTIÓN DE PEDIDOS
const loadAdminOrders = async () => {
    const tbody = document.getElementById('admin-orders-list');
    if (!tbody) return;
    try {
        const response = await fetch('http://localhost:3001/api/orders/all', { headers: { 'auth-token': localStorage.getItem('token') } });
        if (!response.ok) throw new Error("Error al cargar");
        const orders = await response.json();
        if (orders.length === 0) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay pedidos.</td></tr>'; return; }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td class="small px-4">${new Date(order.createdAt).toLocaleDateString()}</td>
                <td class="small fw-bold">${order.user?.name || 'Usuario Eliminado'}<br><span class="text-muted fw-normal" style="font-size: 0.75rem;">${order.user?.email || ''}</span></td>
                <td class="fw-bold text-dark">$${order.totalAmount.toLocaleString('es-AR')}</td>
                <td>
                    <select class="form-select form-select-sm shadow-none border-secondary" id="status-${order._id}">
                        <option value="Pendiente" ${order.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="En Preparación" ${order.status === 'En Preparación' ? 'selected' : ''}>En Preparación</option>
                        <option value="Enviado" ${order.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
                        <option value="Entregado" ${order.status === 'Entregado' ? 'selected' : ''}>Entregado</option>
                        <option value="Cancelado" ${order.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select>
                </td>
                <td><input type="text" class="form-control form-control-sm shadow-none border-secondary bg-light" id="tracking-${order._id}" value="${order.trackingCode || ''}" placeholder="Ej: CP123..."></td>
                <td class="px-4">
                    <div class="d-flex gap-2">
                        <button class="btn btn-dark btn-sm fw-bold flex-grow-1" onclick="updateOrder('${order._id}')">Guardar</button>
                        <button class="btn btn-danger btn-sm fw-bold" onclick="deleteOrder('${order._id}')">X</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error.</td></tr>'; }
};

window.updateOrder = async (orderId) => {
    const status = document.getElementById(`status-${orderId}`).value;
    const trackingCode = document.getElementById(`tracking-${orderId}`).value.trim();
    try {
        const response = await fetch(`http://localhost:3001/api/orders/update-status/${orderId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'auth-token': localStorage.getItem('token') }, body: JSON.stringify({ status, trackingCode }) });
        const data = await response.json();
        if(response.ok) { Swal.fire({ title: 'Actualizado', text: 'Estado actualizado.', icon: 'success', timer: 1500, showConfirmButton: false }); loadInventory(); } else throw new Error(data.message);
    } catch(error) { Swal.fire('Error', error.message, 'error'); }
}

window.deleteOrder = async (orderId) => {
    Swal.fire({
        title: '¿Eliminar?', text: "Se borrará permanentemente.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', cancelButtonColor: '#6c757d', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch(`http://localhost:3001/api/orders/${orderId}`, { method: 'DELETE', headers: { 'auth-token': localStorage.getItem('token') } });
                if (response.ok) { Swal.fire({ title: 'Eliminado', icon: 'success', timer: 1500, showConfirmButton: false }); loadAdminOrders(); loadInventory(); } else { const data = await response.json(); throw new Error(data.message); }
            } catch (error) { Swal.fire('Error', error.message, 'error'); }
        }
    });
};

loadInventory();
loadAdminOrders();
loadCoupons();
loadReviews();