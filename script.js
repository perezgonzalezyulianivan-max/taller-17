"use strict";
 
/* =========================================================
   TALLER 17 - SISTEMA POS DE VENTAS E INVENTARIO
   Universidad de Caldas | Programación Web Creativa II
   Simulación académica: no procesa pagos reales.
   ========================================================= */
 
/* ---------- 1. CONSTANTES Y DATOS INICIALES ---------- */
const CLAVE_PRODUCTOS = "pos_productos_v1";
const CLAVE_VENTAS = "pos_ventas_v1";
const TASA_IVA = 0.19;
const UMBRAL_BAJO = 5;
const METODOS_PAGO = ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia", "Billetera digital"];
 
const PRODUCTOS_EJEMPLO = [
  { id: 1, nombre: "Café molido 500 g", sku: "ALI-001", categoria: "Alimentos", precio: 18500, cantidad: 40 },
  { id: 2, nombre: "Chocolate de mesa 250 g", sku: "ALI-002", categoria: "Alimentos", precio: 7200, cantidad: 25 },
  { id: 3, nombre: "Galletas integrales", sku: "ALI-003", categoria: "Alimentos", precio: 3500, cantidad: 4 },
  { id: 4, nombre: "Agua mineral 600 ml", sku: "BEB-001", categoria: "Bebidas", precio: 2800, cantidad: 60 },
  { id: 5, nombre: "Jugo de naranja 1 L", sku: "BEB-002", categoria: "Bebidas", precio: 6400, cantidad: 18 },
  { id: 6, nombre: "Gaseosa cola 1,5 L", sku: "BEB-003", categoria: "Bebidas", precio: 5900, cantidad: 3 },
  { id: 7, nombre: "Cuaderno cuadriculado", sku: "PAP-001", categoria: "Papelería", precio: 8900, cantidad: 32 },
  { id: 8, nombre: "Bolígrafo azul", sku: "PAP-002", categoria: "Papelería", precio: 1800, cantidad: 80 },
  { id: 9, nombre: "Resaltadores x4", sku: "PAP-003", categoria: "Papelería", precio: 12500, cantidad: 0 },
  { id: 10, nombre: "Memoria USB 64 GB", sku: "TEC-001", categoria: "Tecnología", precio: 38000, cantidad: 14 },
  { id: 11, nombre: "Audífonos con cable", sku: "TEC-002", categoria: "Tecnología", precio: 29900, cantidad: 5 },
  { id: 12, nombre: "Cargador USB-C", sku: "TEC-003", categoria: "Tecnología", precio: 45000, cantidad: 9 }
];
 
/* ---------- 2. ESTADO DE LA APLICACIÓN ---------- */
let productos = [];
let ventas = [];
const carrito = []; // elementos: { id, cantidad }
 
const filtros = {
  catalogo: { texto: "", categoria: "todas" },
  inventario: { texto: "", categoria: "todas" }
};
 
const TITULOS_VISTA = {
  dashboard: "Dashboard",
  ventas: "Punto de venta",
  productos: "Productos e inventario",
  comprobantes: "Comprobantes"
};
 
/* ---------- 3. UTILIDADES ---------- */
const $ = (id) => document.getElementById(id);
 
const formatoMoneda = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const moneda = (valor) => formatoMoneda.format(valor);
 
function normalizar(texto) {
  return String(texto).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
 
function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) {
    elemento.className = clase;
  }
  if (texto !== undefined) {
    elemento.textContent = texto;
  }
  return elemento;
}
 
function formatearFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}
 
let temporizadorAviso;
function mostrarAviso(mensaje, tipo = "") {
  const aviso = $("aviso");
  aviso.textContent = mensaje;
  aviso.className = `toast visible ${tipo}`;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove("visible"), 3200);
}
 
/* ---------- 4. PERSISTENCIA CON LOCALSTORAGE ---------- */
function leerAlmacen(clave, valorPorDefecto) {
  try {
    const texto = localStorage.getItem(clave);
    return texto === null ? valorPorDefecto : JSON.parse(texto);
  } catch (error) {
    return valorPorDefecto;
  }
}
 
function guardarAlmacen(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (error) {
    mostrarAviso("No fue posible guardar los datos en LocalStorage.", "error");
  }
}
 
function guardarTodo() {
  guardarAlmacen(CLAVE_PRODUCTOS, productos);
  guardarAlmacen(CLAVE_VENTAS, ventas);
}
 
function cargarDatos() {
  const guardados = leerAlmacen(CLAVE_PRODUCTOS, null);
  productos = Array.isArray(guardados) ? guardados : PRODUCTOS_EJEMPLO.map((p) => ({ ...p }));
 
  const ventasGuardadas = leerAlmacen(CLAVE_VENTAS, []);
  ventas = Array.isArray(ventasGuardadas) ? ventasGuardadas : [];
 
  guardarTodo();
}
 
/* ---------- 5. LÓGICA DE NEGOCIO ---------- */
const buscarProducto = (id) => productos.find((p) => p.id === Number(id));
const siguienteIdProducto = () => productos.reduce((mayor, p) => Math.max(mayor, p.id), 0) + 1;
 
function siguienteNumeroVenta() {
  const mayor = ventas.reduce((m, v) => Math.max(m, Number(String(v.numero).replace(/\D/g, ""))), 0);
  return `V-${String(mayor + 1).padStart(5, "0")}`;
}
 
function obtenerEstadoStock(producto) {
  if (producto.cantidad === 0) {
    return { texto: "Agotado", clase: "agotado" };
  }
  if (producto.cantidad <= UMBRAL_BAJO) {
    return { texto: "Bajo inventario", clase: "bajo" };
  }
  return { texto: "Disponible", clase: "disponible" };
}
 
function calcularTotales(lineas) {
  const subtotal = lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0);
  const iva = Math.round(subtotal * TASA_IVA);
  return { subtotal, iva, total: subtotal + iva };
}
 
function obtenerLineasCarrito() {
  return carrito
    .map((item) => {
      const producto = buscarProducto(item.id);
      return producto ? { id: producto.id, sku: producto.sku, nombre: producto.nombre, precio: producto.precio, cantidad: item.cantidad } : null;
    })
    .filter((linea) => linea !== null);
}
 
function categoriasDisponibles() {
  return [...new Set(productos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, "es"));
}
 
function filtrarProductos(filtro) {
  const texto = normalizar(filtro.texto);
  return productos.filter((p) => {
    const coincideTexto = texto === "" || normalizar(p.nombre).includes(texto) || normalizar(p.sku).includes(texto);
    const coincideCategoria = filtro.categoria === "todas" || p.categoria === filtro.categoria;
    return coincideTexto && coincideCategoria;
  });
}
 
/* ---------- 6. CARRITO ---------- */
function agregarAlCarrito(id) {
  const producto = buscarProducto(id);
  if (!producto) {
    return;
  }
  if (producto.cantidad === 0) {
    mostrarAviso(`"${producto.nombre}" está agotado.`, "error");
    return;
  }
 
  const existente = carrito.find((item) => item.id === producto.id);
  if (existente) {
    if (existente.cantidad + 1 > producto.cantidad) {
      mostrarAviso(`Solo hay ${producto.cantidad} unidades disponibles de "${producto.nombre}".`, "error");
      return;
    }
    existente.cantidad += 1;
  } else {
    carrito.push({ id: producto.id, cantidad: 1 });
  }
  renderizarCarrito();
}
 
function cambiarCantidad(id, nuevaCantidad) {
  const item = carrito.find((i) => i.id === Number(id));
  const producto = buscarProducto(id);
  if (!item || !producto) {
    return;
  }
 
  const cantidad = Math.floor(Number(nuevaCantidad));
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    quitarDelCarrito(id);
    return;
  }
  if (cantidad > producto.cantidad) {
    item.cantidad = producto.cantidad;
    mostrarAviso(`Existencias insuficientes: máximo ${producto.cantidad} unidades.`, "error");
  } else {
    item.cantidad = cantidad;
  }
  renderizarCarrito();
}
 
function quitarDelCarrito(id) {
  const indice = carrito.findIndex((i) => i.id === Number(id));
  if (indice !== -1) {
    carrito.splice(indice, 1);
  }
  renderizarCarrito();
}
 
function vaciarCarrito() {
  carrito.length = 0;
  $("montoRecibido").value = "";
  renderizarCarrito();
}
 
function registrarVenta() {
  if (carrito.length === 0) {
    mostrarAviso("Agregue al menos un producto al carrito.", "error");
    return;
  }
 
  // Validación final de existencias antes de confirmar la venta
  for (const item of carrito) {
    const producto = buscarProducto(item.id);
    if (!producto || item.cantidad > producto.cantidad) {
      mostrarAviso("Las existencias cambiaron. Revise las cantidades del carrito.", "error");
      renderizarTodo();
      return;
    }
  }
 
  const lineas = obtenerLineasCarrito();
  const totales = calcularTotales(lineas);
  const metodo = $("metodoPago").value;
  const recibido = metodo === "Efectivo" ? Number($("montoRecibido").value) : totales.total;
 
  if (metodo === "Efectivo" && !(recibido >= totales.total)) {
    mostrarAviso("El efectivo recibido es menor al total de la venta.", "error");
    return;
  }
 
  const venta = {
    numero: siguienteNumeroVenta(),
    fecha: new Date().toISOString(),
    lineas: lineas,
    subtotal: totales.subtotal,
    iva: totales.iva,
    total: totales.total,
    metodo: metodo,
    recibido: recibido,
    cambio: recibido - totales.total
  };
 
  // Descuento del inventario
  lineas.forEach((linea) => {
    buscarProducto(linea.id).cantidad -= linea.cantidad;
  });
 
  ventas.push(venta);
  guardarTodo();
 
  carrito.length = 0;
  $("montoRecibido").value = "";
  renderizarTodo();
  mostrarAviso(`Venta ${venta.numero} registrada correctamente.`, "exito");
  abrirComprobante(venta);
}
 
/* ---------- 7. PRODUCTOS (CREAR, EDITAR, ELIMINAR) ---------- */
function limpiarFormulario() {
  $("formProducto").reset();
  $("prodId").value = "";
  $("tituloFormulario").textContent = "Registrar producto";
  $("btnGuardarProducto").textContent = "Guardar producto";
  $("mensajeForm").textContent = "";
}
 
function validarProducto(datos) {
  if (datos.nombre === "") {
    return "El nombre del producto es obligatorio.";
  }
  if (datos.sku === "") {
    return "El código o SKU es obligatorio.";
  }
  const duplicado = productos.some((p) => normalizar(p.sku) === normalizar(datos.sku) && p.id !== datos.id);
  if (duplicado) {
    return "Ya existe un producto con ese código o SKU.";
  }
  if (datos.categoria === "") {
    return "La categoría es obligatoria.";
  }
  if (!Number.isFinite(datos.precio) || datos.precio <= 0) {
    return "El precio debe ser un número mayor que cero.";
  }
  if (!Number.isInteger(datos.cantidad) || datos.cantidad < 0) {
    return "La cantidad debe ser un número entero igual o mayor que cero.";
  }
  return "";
}
 
function guardarProducto(evento) {
  evento.preventDefault();
 
  const idActual = $("prodId").value;
  const datos = {
    id: idActual === "" ? 0 : Number(idActual),
    nombre: $("prodNombre").value.trim(),
    sku: $("prodSku").value.trim().toUpperCase(),
    categoria: $("prodCategoria").value.trim(),
    precio: Number($("prodPrecio").value),
    cantidad: Number($("prodCantidad").value)
  };
 
  const error = validarProducto(datos);
  if (error !== "") {
    $("mensajeForm").textContent = error;
    return;
  }
 
  if (idActual === "") {
    datos.id = siguienteIdProducto();
    productos.push(datos);
    mostrarAviso(`Producto "${datos.nombre}" registrado.`, "exito");
  } else {
    const producto = buscarProducto(idActual);
    Object.assign(producto, datos);
    mostrarAviso(`Producto "${datos.nombre}" actualizado.`, "exito");
  }
 
  guardarTodo();
  limpiarFormulario();
  renderizarTodo();
}
 
function editarProducto(id) {
  const producto = buscarProducto(id);
  if (!producto) {
    return;
  }
  $("prodId").value = producto.id;
  $("prodNombre").value = producto.nombre;
  $("prodSku").value = producto.sku;
  $("prodCategoria").value = producto.categoria;
  $("prodPrecio").value = producto.precio;
  $("prodCantidad").value = producto.cantidad;
  $("tituloFormulario").textContent = `Editar producto: ${producto.nombre}`;
  $("btnGuardarProducto").textContent = "Actualizar producto";
  $("mensajeForm").textContent = "";
  $("formProducto").scrollIntoView({ behavior: "smooth", block: "center" });
  $("prodNombre").focus();
}
 
function eliminarProducto(id) {
  const producto = buscarProducto(id);
  if (!producto) {
    return;
  }
  if (!confirm(`¿Eliminar el producto "${producto.nombre}" del inventario?`)) {
    return;
  }
 
  productos = productos.filter((p) => p.id !== producto.id);
  const indiceCarrito = carrito.findIndex((i) => i.id === producto.id);
  if (indiceCarrito !== -1) {
    carrito.splice(indiceCarrito, 1);
  }
  if ($("prodId").value === String(producto.id)) {
    limpiarFormulario();
  }
 
  guardarTodo();
  renderizarTodo();
  mostrarAviso("Producto eliminado.", "exito");
}
 
function restaurarDatos() {
  if (!confirm("Se borrarán los productos y las ventas actuales y se cargarán los datos de ejemplo. ¿Continuar?")) {
    return;
  }
  productos = PRODUCTOS_EJEMPLO.map((p) => ({ ...p }));
  ventas = [];
  carrito.length = 0;
  guardarTodo();
  limpiarFormulario();
  renderizarTodo();
  mostrarAviso("Datos de ejemplo restaurados.", "exito");
}
 
/* ---------- 8. RENDERIZADO DE VISTAS ---------- */
function llenarSelectCategorias(select, valorActual) {
  select.replaceChildren();
  select.add(new Option("Todas las categorías", "todas"));
  categoriasDisponibles().forEach((categoria) => select.add(new Option(categoria, categoria)));
  select.value = categoriasDisponibles().includes(valorActual) ? valorActual : "todas";
}
 
function renderizarCategorias() {
  filtros.catalogo.categoria = llenarSelectYDevolver($("filtroCategoriaCatalogo"), filtros.catalogo.categoria);
  filtros.inventario.categoria = llenarSelectYDevolver($("filtroCategoriaInventario"), filtros.inventario.categoria);
 
  const lista = $("listaCategorias");
  lista.replaceChildren();
  categoriasDisponibles().forEach((categoria) => lista.appendChild(new Option(categoria)));
}
 
function llenarSelectYDevolver(select, valorActual) {
  llenarSelectCategorias(select, valorActual);
  return select.value;
}
 
function renderizarDashboard() {
  const acumulado = ventas.reduce((suma, v) => suma + v.total, 0);
  const bajos = productos.filter((p) => p.cantidad <= UMBRAL_BAJO).sort((a, b) => a.cantidad - b.cantidad);
 
  $("kpiProductos").textContent = productos.length;
  $("kpiVentas").textContent = ventas.length;
  $("kpiAcumulado").textContent = moneda(acumulado);
  $("kpiBajo").textContent = bajos.length;
 
  const listaBajo = $("listaBajo");
  listaBajo.replaceChildren();
  if (bajos.length === 0) {
    listaBajo.appendChild(crear("li", "", "Todos los productos tienen existencias suficientes."));
  }
  bajos.forEach((p) => {
    const item = crear("li");
    item.appendChild(crear("span", "", p.nombre));
    const estado = obtenerEstadoStock(p);
    item.appendChild(crear("span", `etiqueta-estado ${estado.clase}`, `${estado.texto}: ${p.cantidad}`));
    listaBajo.appendChild(item);
  });
 
  const cuerpo = $("ultimasVentas");
  cuerpo.replaceChildren();
  const ultimas = ventas.slice(-5).reverse();
  if (ultimas.length === 0) {
    const fila = crear("tr");
    const celda = crear("td", "fila-vacia", "Aún no se han registrado ventas.");
    celda.colSpan = 4;
    fila.appendChild(celda);
    cuerpo.appendChild(fila);
  }
  ultimas.forEach((v) => {
    const fila = crear("tr");
    fila.append(crear("td", "", v.numero), crear("td", "", formatearFecha(v.fecha)), crear("td", "", v.metodo), crear("td", "num", moneda(v.total)));
    cuerpo.appendChild(fila);
  });
}
 
function renderizarCatalogo() {
  const contenedor = $("catalogo");
  contenedor.replaceChildren();
  const lista = filtrarProductos(filtros.catalogo);
 
  if (lista.length === 0) {
    contenedor.appendChild(crear("p", "muted", "No se encontraron productos."));
    return;
  }
 
  lista.forEach((p) => {
    const tarjeta = crear("article", "producto-card");
    const estado = obtenerEstadoStock(p);
 
    tarjeta.appendChild(crear("h3", "", p.nombre));
    tarjeta.appendChild(crear("small", "", `${p.sku} · ${p.categoria}`));
    tarjeta.appendChild(crear("strong", "precio", moneda(p.precio)));
    tarjeta.appendChild(crear("span", `etiqueta-estado ${estado.clase}`, `${estado.texto} (${p.cantidad})`));
 
    const boton = crear("button", "btn btn-azul", p.cantidad === 0 ? "Sin existencias" : "Agregar al carrito");
    boton.type = "button";
    boton.dataset.accion = "agregar";
    boton.dataset.id = p.id;
    boton.disabled = p.cantidad === 0;
    tarjeta.appendChild(boton);
 
    contenedor.appendChild(tarjeta);
  });
}
 
function crearBotonCantidad(texto, accion, id) {
  const boton = crear("button", "", texto);
  boton.type = "button";
  boton.dataset.accion = accion;
  boton.dataset.id = id;
  return boton;
}
 
function renderizarCarrito() {
  const lista = $("listaCarrito");
  lista.replaceChildren();
  const lineas = obtenerLineasCarrito();
 
  if (lineas.length === 0) {
    lista.appendChild(crear("li", "vacio", "El carrito está vacío."));
  }
 
  lineas.forEach((linea) => {
    const item = crear("li", "item-carrito");
 
    const fila = crear("div", "fila");
    fila.appendChild(crear("span", "nombre", linea.nombre));
    const quitar = crear("button", "btn btn-rojo btn-pequeno", "Quitar");
    quitar.type = "button";
    quitar.dataset.accion = "quitar";
    quitar.dataset.id = linea.id;
    fila.appendChild(quitar);
    item.appendChild(fila);
    item.appendChild(crear("small", "muted", `${moneda(linea.precio)} c/u`));
 
    const control = crear("div", "control-cantidad");
    const entrada = crear("input");
    entrada.type = "number";
    entrada.min = "1";
    entrada.value = linea.cantidad;
    entrada.dataset.accion = "cantidad";
    entrada.dataset.id = linea.id;
    entrada.setAttribute("aria-label", `Cantidad de ${linea.nombre}`);
    control.append(
      crearBotonCantidad("-", "menos", linea.id),
      entrada,
      crearBotonCantidad("+", "mas", linea.id),
      crear("span", "subtotal-item", moneda(linea.precio * linea.cantidad))
    );
    item.appendChild(control);
 
    lista.appendChild(item);
  });
 
  const totales = calcularTotales(lineas);
  $("resSubtotal").textContent = moneda(totales.subtotal);
  $("resIva").textContent = moneda(totales.iva);
  $("resTotal").textContent = moneda(totales.total);
  $("btnRegistrar").disabled = lineas.length === 0;
  actualizarCambio();
}
 
function actualizarCambio() {
  const esEfectivo = $("metodoPago").value === "Efectivo";
  $("campoEfectivo").style.display = esEfectivo ? "block" : "none";
 
  const totales = calcularTotales(obtenerLineasCarrito());
  const recibido = Number($("montoRecibido").value);
  const cambio = recibido > totales.total ? recibido - totales.total : 0;
  $("resCambio").textContent = moneda(cambio);
}
 
function renderizarInventario() {
  const cuerpo = $("cuerpoInventario");
  cuerpo.replaceChildren();
  const lista = filtrarProductos(filtros.inventario);
 
  $("resumenInventario").textContent = `${lista.length} de ${productos.length} productos · ${productos.reduce((s, p) => s + p.cantidad, 0)} unidades en existencia`;
 
  if (lista.length === 0) {
    const fila = crear("tr");
    const celda = crear("td", "fila-vacia", "No se encontraron productos con los filtros actuales.");
    celda.colSpan = 7;
    fila.appendChild(celda);
    cuerpo.appendChild(fila);
    return;
  }
 
  lista.forEach((p) => {
    const fila = crear("tr");
    const estado = obtenerEstadoStock(p);
 
    const acciones = crear("div", "acciones-tabla");
    const editar = crear("button", "btn btn-gris btn-pequeno", "Editar");
    editar.type = "button";
    editar.dataset.accion = "editar";
    editar.dataset.id = p.id;
    const eliminar = crear("button", "btn btn-rojo btn-pequeno", "Eliminar");
    eliminar.type = "button";
    eliminar.dataset.accion = "eliminar";
    eliminar.dataset.id = p.id;
    acciones.append(editar, eliminar);
 
    const celdaEstado = crear("td");
    celdaEstado.appendChild(crear("span", `etiqueta-estado ${estado.clase}`, estado.texto));
    const celdaAcciones = crear("td");
    celdaAcciones.appendChild(acciones);
 
    fila.append(
      crear("td", "", p.sku),
      crear("td", "", p.nombre),
      crear("td", "", p.categoria),
      crear("td", "num", moneda(p.precio)),
      crear("td", "num", p.cantidad),
      celdaEstado,
      celdaAcciones
    );
    cuerpo.appendChild(fila);
  });
}
 
function renderizarHistorial() {
  const cuerpo = $("cuerpoHistorial");
  cuerpo.replaceChildren();
 
  if (ventas.length === 0) {
    const fila = crear("tr");
    const celda = crear("td", "fila-vacia", "Aún no se han registrado ventas.");
    celda.colSpan = 8;
    fila.appendChild(celda);
    cuerpo.appendChild(fila);
    return;
  }
 
  ventas.slice().reverse().forEach((v) => {
    const fila = crear("tr");
    const boton = crear("button", "btn btn-azul btn-pequeno", "Ver comprobante");
    boton.type = "button";
    boton.dataset.accion = "ver";
    boton.dataset.numero = v.numero;
    const celdaBoton = crear("td");
    celdaBoton.appendChild(boton);
 
    fila.append(
      crear("td", "", v.numero),
      crear("td", "", formatearFecha(v.fecha)),
      crear("td", "", v.metodo),
      crear("td", "num", v.lineas.reduce((s, l) => s + l.cantidad, 0)),
      crear("td", "num", moneda(v.subtotal)),
      crear("td", "num", moneda(v.iva)),
      crear("td", "num", moneda(v.total)),
      celdaBoton
    );
    cuerpo.appendChild(fila);
  });
}
 
function renderizarTodo() {
  renderizarCategorias();
  renderizarDashboard();
  renderizarCatalogo();
  renderizarCarrito();
  renderizarInventario();
  renderizarHistorial();
}
 
/* ---------- 9. COMPROBANTE DE VENTA ---------- */
function crearLineaTotal(etiqueta, valor, clase = "") {
  const linea = crear("div", `linea-total ${clase}`);
  linea.append(crear("span", "", etiqueta), crear("span", "", valor));
  return linea;
}
 
function abrirComprobante(venta) {
  const contenido = $("comprobanteContenido");
  contenido.replaceChildren();
 
  const encabezado = crear("div", "centro");
  encabezado.append(
    crear("h2", "", "POS ACADÉMICO"),
    crear("div", "", "Universidad de Caldas"),
    crear("div", "", "Programación Web Creativa II"),
    crear("div", "", "NIT 900.000.000-0 (ficticio)")
  );
 
  const datos = crear("div", "datos");
  [["Comprobante N.º", venta.numero], ["Fecha", formatearFecha(venta.fecha)], ["Método de pago", venta.metodo]].forEach(([etiqueta, valor]) => {
    const fila = crear("div");
    fila.append(crear("span", "", etiqueta), crear("strong", "", valor));
    datos.appendChild(fila);
  });
 
  const tabla = crear("table");
  const cabecera = crear("thead");
  const filaCabecera = crear("tr");
  ["Producto", "Cant.", "P. unit.", "Total"].forEach((titulo, i) => filaCabecera.appendChild(crear("th", i === 0 ? "" : "num", titulo)));
  cabecera.appendChild(filaCabecera);
  tabla.appendChild(cabecera);
 
  const cuerpo = crear("tbody");
  venta.lineas.forEach((l) => {
    const fila = crear("tr");
    fila.append(
      crear("td", "", l.nombre),
      crear("td", "num", l.cantidad),
      crear("td", "num", moneda(l.precio)),
      crear("td", "num", moneda(l.precio * l.cantidad))
    );
    cuerpo.appendChild(fila);
  });
  tabla.appendChild(cuerpo);
 
  const totales = crear("div", "totales-comprobante");
  totales.append(
    crearLineaTotal("Subtotal", moneda(venta.subtotal)),
    crearLineaTotal("IVA (19 %)", moneda(venta.iva)),
    crearLineaTotal("TOTAL", moneda(venta.total), "grande")
  );
  if (venta.metodo === "Efectivo") {
    totales.append(crearLineaTotal("Efectivo recibido", moneda(venta.recibido)), crearLineaTotal("Cambio", moneda(venta.cambio)));
  }
 
  const nota = crear("p", "nota", "Comprobante simulado con fines académicos. Sin validez fiscal. ¡Gracias por su compra!");
 
  contenido.append(encabezado, datos, tabla, totales, nota);
 
  $("modalComprobante").classList.add("abierto");
  $("btnImprimir").focus();
}
 
function cerrarComprobante() {
  $("modalComprobante").classList.remove("abierto");
}
 
/* ---------- 10. NAVEGACIÓN ---------- */
function cambiarVista(nombre) {
  document.querySelectorAll(".vista").forEach((vista) => vista.classList.toggle("activa", vista.id === `vista-${nombre}`));
  document.querySelectorAll(".menu-link").forEach((boton) => boton.classList.toggle("active", boton.dataset.vista === nombre));
  $("tituloVista").textContent = TITULOS_VISTA[nombre];
  alternarMenu(false);
  window.scrollTo({ top: 0 });
}
 
function alternarMenu(abrir) {
  $("sidebar").classList.toggle("open", abrir);
  $("overlay").classList.toggle("visible", abrir);
}
 
/* ---------- 11. EVENTOS E INICIO ---------- */
function registrarEventos() {
  document.querySelectorAll(".menu-link").forEach((boton) => boton.addEventListener("click", () => cambiarVista(boton.dataset.vista)));
  $("btnMenu").addEventListener("click", () => alternarMenu(!$("sidebar").classList.contains("open")));
  $("overlay").addEventListener("click", () => alternarMenu(false));
 
  // Catálogo
  $("buscadorCatalogo").addEventListener("input", (e) => {
    filtros.catalogo.texto = e.target.value;
    renderizarCatalogo();
  });
  $("filtroCategoriaCatalogo").addEventListener("change", (e) => {
    filtros.catalogo.categoria = e.target.value;
    renderizarCatalogo();
  });
  $("catalogo").addEventListener("click", (e) => {
    const boton = e.target.closest("[data-accion='agregar']");
    if (boton) {
      agregarAlCarrito(boton.dataset.id);
    }
  });
 
  // Carrito
  $("listaCarrito").addEventListener("click", (e) => {
    const boton = e.target.closest("button[data-accion]");
    if (!boton) {
      return;
    }
    const item = carrito.find((i) => i.id === Number(boton.dataset.id));
    if (boton.dataset.accion === "quitar") {
      quitarDelCarrito(boton.dataset.id);
    } else if (boton.dataset.accion === "mas" && item) {
      cambiarCantidad(boton.dataset.id, item.cantidad + 1);
    } else if (boton.dataset.accion === "menos" && item) {
      cambiarCantidad(boton.dataset.id, item.cantidad - 1);
    }
  });
  $("listaCarrito").addEventListener("change", (e) => {
    if (e.target.dataset.accion === "cantidad") {
      cambiarCantidad(e.target.dataset.id, e.target.value);
    }
  });
  $("metodoPago").addEventListener("change", actualizarCambio);
  $("montoRecibido").addEventListener("input", actualizarCambio);
  $("btnRegistrar").addEventListener("click", registrarVenta);
  $("btnVaciar").addEventListener("click", vaciarCarrito);
 
  // Productos e inventario
  $("formProducto").addEventListener("submit", guardarProducto);
  $("btnCancelarEdicion").addEventListener("click", limpiarFormulario);
  $("buscadorInventario").addEventListener("input", (e) => {
    filtros.inventario.texto = e.target.value;
    renderizarInventario();
  });
  $("filtroCategoriaInventario").addEventListener("change", (e) => {
    filtros.inventario.categoria = e.target.value;
    renderizarInventario();
  });
  $("btnRestaurar").addEventListener("click", restaurarDatos);
  $("cuerpoInventario").addEventListener("click", (e) => {
    const boton = e.target.closest("button[data-accion]");
    if (!boton) {
      return;
    }
    if (boton.dataset.accion === "editar") {
      editarProducto(boton.dataset.id);
    } else if (boton.dataset.accion === "eliminar") {
      eliminarProducto(boton.dataset.id);
    }
  });
 
  // Comprobantes
  $("cuerpoHistorial").addEventListener("click", (e) => {
    const boton = e.target.closest("[data-accion='ver']");
    if (boton) {
      abrirComprobante(ventas.find((v) => v.numero === boton.dataset.numero));
    }
  });
  $("btnImprimir").addEventListener("click", () => window.print());
  $("btnCerrarModal").addEventListener("click", cerrarComprobante);
  $("modalComprobante").addEventListener("click", (e) => {
    if (e.target === $("modalComprobante")) {
      cerrarComprobante();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cerrarComprobante();
    }
  });
}
 
function iniciar() {
  const fecha = new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  $("fechaActual").textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);
 
  const selectorPago = $("metodoPago");
  METODOS_PAGO.forEach((metodo) => selectorPago.add(new Option(metodo, metodo)));
 
  cargarDatos();
  registrarEventos();
  renderizarTodo();
}
 
document.addEventListener("DOMContentLoaded", iniciar);
