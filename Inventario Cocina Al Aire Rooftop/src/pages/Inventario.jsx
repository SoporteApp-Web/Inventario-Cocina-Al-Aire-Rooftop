// src/pages/Inventario.jsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { FaPlus, FaFilePdf, FaFileImage } from 'react-icons/fa'
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas'

export default function Inventario({ profile }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState({ user: 'N/A', date: 'N/A' })

  // Estados para el formulario de movimientos
  const [productName, setProductName] = useState('')
  const [movementType, setMovementType] = useState('ingreso-bodega')
  const [quantity, setQuantity] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Estados para las sugerencias de autocompletado
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  // Estado para el campo de búsqueda
  const [searchTerm, setSearchTerm] = useState('')
  // Estado para bloquear/desbloquear la edición
  const [isLocked, setIsLocked] = useState(false)
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  // Estado para el modal de "Guardar"
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [saveError, setSaveError] = useState('');


  // Estados para el modal de "Agregar Producto"
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({ nombre: '', bodega: 0, cocina: 0, stock_min: 0, stock_max: 0 })
  // Estados para el modal de "Editar Producto"
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  // Estados para el modal de "Borrar Producto"
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingProduct, setDeletingProduct] = useState(null)

  const autocompleteRef = useRef(null)
  const tableRef = useRef(null)

  // Efecto para cerrar las sugerencias si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    // Añadir el listener
    document.addEventListener('mousedown', handleClickOutside)
    // Limpiar el listener al desmontar el componente
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [autocompleteRef])


  const handleEdit = (product) => {
    // Carga los datos del producto en el estado y abre el modal
    setEditingProduct(product)
    setIsEditModalOpen(true)
  }

  const handleDelete = (product) => {
    // Carga los datos del producto y abre el modal de confirmación
    setDeletingProduct(product)
    setIsDeleteModalOpen(true)
  }

  // Función para encontrar la última actualización en toda la tabla
  function findLastUpdate(productsData) {
    if (productsData.length === 0) return

    const latestProduct = productsData.reduce((latest, current) => {
      return new Date(latest.updated_at) > new Date(current.updated_at) ? latest : current
    })

    if (latestProduct && latestProduct.profiles) {
      const userName = `${latestProduct.profiles.nombre} ${latestProduct.profiles.apellido}`
      const updateDate = new Date(latestProduct.updated_at).toLocaleString()
      setLastUpdate({ user: userName, date: updateDate })
    }
  }

  async function fetchProducts() {
    setLoading(true)
    // Obtenemos los productos y la información del perfil de quien actualizó
    const { data, error } = await supabase
      .from('products')
      .select(`
        id, nombre, bodega, cocina, stock_min, stock_max, updated_at, updated_by, ingreso, salida,
        profiles ( nombre, apellido )
      `)
      .order('nombre', { ascending: true })

    if (error) {
      console.error('Error fetching products:', error)
      setProducts([]) // En caso de error, vaciamos la tabla para evitar datos viejos
    } else {
      setProducts(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleMovement = async (event) => {
    event.preventDefault()
    if (!productName || !movementType || !quantity || quantity <= 0) {
      alert('Por favor, completa todos los campos correctamente.')
      return
    }

    setIsSubmitting(true)

    const product = products.find((p) => p.nombre.toLowerCase() === productName.toLowerCase())
    if (!product) {
      alert('Producto no encontrado. Asegúrate de que el nombre esté escrito correctamente.')
      setIsSubmitting(false)
      return
    }

    let { bodega, cocina } = product
    const moveQuantity = parseInt(quantity)

    switch (movementType) {
      case 'ingreso-bodega':
        bodega += moveQuantity
        break
      case 'ingreso-cocina':
        cocina += moveQuantity
        break
      case 'bodega-a-cocina':
        if (bodega < moveQuantity) {
          alert('No hay suficiente stock en la bodega para este movimiento.')
          setIsSubmitting(false)
          return
        }
        bodega -= moveQuantity
        cocina += moveQuantity
        break
      case 'salida-bodega':
        if (bodega < moveQuantity) {
          alert('No hay suficiente stock en la bodega para dar salida.')
          setIsSubmitting(false)
          return
        }
        bodega -= moveQuantity
        break
      case 'salida-cocina':
        if (cocina < moveQuantity) {
          alert('No hay suficiente stock en la cocina para dar salida.')
          setIsSubmitting(false)
          return
        }
        cocina -= moveQuantity
        break
      default:
        setIsSubmitting(false)
        return
    }

    const { data: { user } } = await supabase.auth.getUser()
    
    // Calculamos los nuevos valores acumulados de ingreso y salida
    const isIngreso = movementType.startsWith('ingreso');
    const isSalida = movementType.startsWith('salida');
    const newIngreso = isIngreso ? product.ingreso + moveQuantity : product.ingreso;
    const newSalida = isSalida ? product.salida + moveQuantity : product.salida;

    // 1. Actualizar el stock del producto
    const { error: updateError } = await supabase
      .from('products')
      .update({ bodega, cocina, ingreso: newIngreso, salida: newSalida, updated_by: user.id })
      .eq('id', product.id)
      .select() // ¡Este es el cambio clave!

    if (updateError) {
      alert('Error al actualizar el stock: ' + updateError.message)
      setIsSubmitting(false);
      return;
    }

    // 2. Insertar el registro del movimiento
    const { error: insertError } = await supabase.from('product_movements').insert({
      product_id: product.id,
      movement_type: movementType,
      quantity: moveQuantity,
      moved_by: user.id,
      report_date: reportDate, // Guardamos la fecha del reporte actual
    });

    if (insertError) {
      alert('Error al registrar el movimiento: ' + insertError.message)
    } else {
      // Actualizar la UI para mostrar el movimiento en la tabla
      setProducts(currentProducts =>
        currentProducts.map(p => {
          if (p.id === product.id) {
            return {
              ...p,
              bodega, // Actualizamos el stock de bodega
              cocina, // Actualizamos el stock de cocina
              ingreso: newIngreso,
              salida: newSalida,
            }
          }
          // Devolvemos los demás productos sin cambios
          return p
        })
      )
      // Limpiar formulario
      setProductName('')
      setMovementType('ingreso-bodega')
      setQuantity('')
    }
    setIsSubmitting(false)
  }

  const handleProductNameChange = (e) => {
    const value = e.target.value
    setProductName(value)

    if (value.length > 0) {
      const filteredSuggestions = products.filter((p) =>
        p.nombre.toLowerCase().includes(value.toLowerCase())
      )
      setSuggestions(filteredSuggestions)
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleSuggestionClick = (suggestionName) => {
    setProductName(suggestionName)
    setShowSuggestions(false)
  }

  const handleNewProductChange = (e) => {
    const { name, value } = e.target
    setNewProduct(prev => ({ ...prev, [name]: value }))
  }

  const handleCreateProduct = async (event) => {
    event.preventDefault()
    if (!newProduct.nombre) {
      alert('El nombre del producto es obligatorio.')
      return
    }

    setIsSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('products').insert({
      nombre: newProduct.nombre,
      bodega: parseInt(newProduct.bodega) || 0,
      cocina: parseInt(newProduct.cocina) || 0,
      stock_min: parseInt(newProduct.stock_min) || 0,
      stock_max: parseInt(newProduct.stock_max) || 0,
      ingreso: 0, // Añadimos el valor inicial
      salida: 0,  // Añadimos el valor inicial
      updated_by: user.id,
    })

    if (error) {
      alert('Error al crear el producto: ' + error.message)
    } else {
      // Cerrar modal, limpiar formulario y refrescar tabla
      setIsAddModalOpen(false)
      setNewProduct({ nombre: '', bodega: 0, cocina: 0, stock_min: 0, stock_max: 0 })
      await fetchProducts()
    }
    setIsSubmitting(false)
  }

  const handleEditingProductChange = (e) => {
    const { name, value } = e.target
    setEditingProduct(prev => ({ ...prev, [name]: value }))
  }

  const handleUpdateProduct = async (event) => {
    event.preventDefault()
    if (!editingProduct) return

    setIsSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('products')
      .update({
        nombre: editingProduct.nombre,
        bodega: parseInt(editingProduct.bodega) || 0,
        cocina: parseInt(editingProduct.cocina) || 0,
        stock_min: parseInt(editingProduct.stock_min) || 0,
        stock_max: parseInt(editingProduct.stock_max) || 0,
        updated_by: user.id,
      })
      .eq('id', editingProduct.id)
      .select()

    if (error) {
      alert('Error al actualizar el producto: ' + error.message)
    } else {
      // Cerrar modal, limpiar estado y refrescar tabla
      setIsEditModalOpen(false)
      setEditingProduct(null)
      await fetchProducts()
    }
    setIsSubmitting(false)
  }

  const confirmDelete = async () => {
    if (!deletingProduct) return

    setIsSubmitting(true)
    const { error } = await supabase.from('products').delete().eq('id', deletingProduct.id)

    if (error) {
      alert('Error al eliminar el producto: ' + error.message)
    } else {
      // Cierra el modal y refresca la lista
      setIsDeleteModalOpen(false)
      setDeletingProduct(null)
      await fetchProducts()
    }
    setIsSubmitting(false)
  }

  const handleConfirmSave = async () => {
    if (!reportDate) {
      setSaveError('Por favor, selecciona una fecha para el reporte.');
      return;
    }

    setIsSubmitting(true);
    setSaveError('');
    const { data: { user } } = await supabase.auth.getUser();

    try {
      // 1. Verificar si ya existe un reporte para esta fecha
      const { data: existing, error: checkError } = await supabase
        .from('inventory_snapshots')
        .select('id')
        .eq('report_date', reportDate)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        setSaveError('Ya existe un reporte para esta fecha. Por favor, elige otra.');
        setIsSubmitting(false);
        return;
      }

      // 2. Guardar la nueva instantánea del inventario
      const { error: insertError } = await supabase.from('inventory_snapshots').insert({
        report_date: reportDate,
        saved_by: user.id,
        snapshot: products, // Guardamos el estado actual de los productos
      });

      if (insertError) throw insertError;

      // 3. Si todo fue exitoso, bloqueamos la UI
      setIsLocked(true);
      setIsSaveModalOpen(false);
    } catch (err) {
      setSaveError('Ocurrió un error al guardar el reporte: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    import('jspdf-autotable').then(autoTable => {
    // Filtra los productos que se están mostrando actualmente en la tabla
    const filteredProducts = products.filter((product) =>
      product.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
 
    const doc = new jsPDF();
    const downloaderName = profile ? `${profile.nombre} ${profile.apellido}` : 'Usuario Desconocido';
    const downloadDate = new Date().toLocaleString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Título y subtítulos
    doc.setFontSize(18);
    doc.text("Reporte de Inventario - Al Aire Rooftop", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Descargado por: ${downloaderName}`, 14, 30);
    doc.text(`Fecha de descarga: ${downloadDate}`, 14, 35);


    // Preparar datos para la tabla
    const tableColumn = ["Producto", "Bodega", "Ingreso", "Salida", "Cocina", "Total"];
    const tableRows = [];

    filteredProducts.forEach(product => {
      const productData = [
        product.nombre,
        product.bodega,
        product.ingreso,
        product.salida,
        product.cocina,
        product.bodega + product.cocina,
      ];
      tableRows.push(productData);
    });

    autoTable.default(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45, // Iniciar la tabla más abajo
      headStyles: { fillColor: [0, 21, 41] }, // Color azul oscuro del sidebar
      didDrawPage: function (data) {
        // Footer solo con número de página
        doc.setFontSize(10);
        doc.text('Página ' + doc.internal.getNumberOfPages(), data.settings.margin.left, doc.internal.pageSize.height - 10);
      }
    })

    doc.save('reporte-inventario.pdf')
    setIsDownloadModalOpen(false)
    });
  }

  const handleDownloadImage = async () => {
    const captureElement = document.getElementById('capture-container');
    if (!captureElement) return;

    html2canvas(captureElement, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = 'reporte-inventario.png';
      link.click();
    });

    setIsDownloadModalOpen(false);
  }

  if (loading) {
    return <div>Cargando inventario...</div>
  }

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h1>Gestión de Inventario</h1>
        {profile?.roles?.can_add_product && (
          <button className="add-product-button" onClick={() => setIsAddModalOpen(true)}>
            <FaPlus /> Agregar Producto
          </button>
        )}
      </div>

      <div className="search-container">
        <input
          type="text"
          placeholder="Buscar producto por nombre..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Botones de Acción Global */}
      <div className="inventory-actions">
        {profile?.roles?.can_save_inventory && (
          <button
            className="action-btn save"
            onClick={() => setIsSaveModalOpen(true)}
            disabled={isLocked}
          >
            Guardado
          </button>
        )}
        {profile?.roles?.can_review_inventory && (
          <button
            className="action-btn review"
            onClick={async () => {
              if (window.confirm('¿Seguro que quieres reiniciar los contadores de Ingreso y Salida?')) {
                // Actualiza todos los productos en la DB
                await supabase.from('products').update({ ingreso: 0, salida: 0 }).gt('id', 0)
                // Refresca la tabla y desbloquea la edición
                await fetchProducts()
                setIsLocked(false)
              }
            }}
            disabled={!isLocked}
          >
            Revisado
          </button>
        )}
        <button
          className="action-btn download"
          onClick={() => setIsDownloadModalOpen(true)}
        >
          Descargar
        </button>
      </div>

      <div className="table-responsive">
        <table className="inventory-table" ref={tableRef}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Bodega</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th>Cocina</th>
              <th>Total</th>
              <th className="hide-on-download">Stock Min</th>
              <th className="hide-on-download">Stock Max</th>
              <th>Responsable</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products
              .filter((product) =>
                product.nombre.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((product) => (
              <tr key={product.id}>
                <td>{product.nombre}</td>
                <td>{product.bodega}</td>
                <td>{product.ingreso}</td>
                <td>{product.salida}</td>
                <td>{product.cocina}</td>
                <td>{product.bodega + product.cocina}</td>
                <td className="hide-on-download">{product.stock_min}</td>
                <td className="hide-on-download">{product.stock_max}</td>
                <td className="responsable-cell">
                  {product.profiles ? `${product.profiles.nombre} ${product.profiles.apellido}` : 'N/A'}<br />
                  <span>{new Date(product.updated_at).toLocaleString()}</span>
                </td>
                {profile?.roles?.can_edit_inventory && (
                  <td className="actions-cell">
                    <button onClick={() => handleEdit(product)} className="action-button edit-button" disabled={isLocked}>✏️</button>
                    <button onClick={() => handleDelete(product)} className="action-button delete-button" disabled={isLocked}>🗑️</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjeta para Registrar Movimientos */}
      <div className="movement-card">
        <h2>Registrar Movimiento</h2>
        <fieldset disabled={isLocked || !profile?.roles?.can_register_movement} className="movement-fieldset">
          <form className="movement-form" onSubmit={handleMovement} autoComplete="off" >
            <div className="form-group autocomplete-wrapper" ref={autocompleteRef}>
              <label htmlFor="product-input">Producto</label>
              <input
                id="product-input"
                type="text"
                placeholder="Escribe el nombre del producto"
                value={productName}
                onChange={handleProductNameChange}
                onFocus={() => productName.length > 0 && setShowSuggestions(true)}
                required
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="suggestions-list">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.id} onClick={() => handleSuggestionClick(suggestion.nombre)}>{suggestion.nombre}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="movement-type">Tipo de Movimiento</label>
              <select id="movement-type" value={movementType} onChange={(e) => setMovementType(e.target.value)} required>
                <option value="ingreso-bodega">Ingreso a Bodega</option>
                <option value="ingreso-cocina">Ingreso a Cocina</option>
                <option value="bodega-a-cocina">Bodega a Cocina</option>
                <option value="salida-bodega">Salida de Bodega</option>
                <option value="salida-cocina">Salida de Cocina</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="quantity">Cantidad</label>
              <input id="quantity" type="number" min="1" placeholder="Ej: 10" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <button type="submit" className="movement-button" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Realizar Movimiento'}
            </button>
          </form>
        </fieldset>
      </div>

      {/* Modal para Agregar Producto */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <h2 className="modal-title">Agregar Nuevo Producto</h2>
            <form onSubmit={handleCreateProduct} className="modal-form">
              <div className="form-group">
                <label htmlFor="nombre">Nombre del Producto</label>
                <input type="text" id="nombre" name="nombre" value={newProduct.nombre} onChange={handleNewProductChange} required />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="bodega">Stock Bodega</label>
                  <input type="number" id="bodega" name="bodega" value={newProduct.bodega} onChange={handleNewProductChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="cocina">Stock Cocina</label>
                  <input type="number" id="cocina" name="cocina" value={newProduct.cocina} onChange={handleNewProductChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="stock_min">Stock Mínimo</label>
                  <input type="number" id="stock_min" name="stock_min" value={newProduct.stock_min} onChange={handleNewProductChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="stock_max">Stock Máximo</label>
                  <input type="number" id="stock_max" name="stock_max" value={newProduct.stock_max} onChange={handleNewProductChange} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="modal-button-cancel" onClick={() => setIsAddModalOpen(false)}>Cancelar</button>
                <button type="submit" className="modal-button-confirm" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Editar Producto */}
      {isEditModalOpen && editingProduct && (
        <div className="modal-overlay">
          <div className="modal-content modal-lg">
            <h2 className="modal-title">Editar Producto</h2>
            <form onSubmit={handleUpdateProduct} className="modal-form">
              <div className="form-group">
                <label htmlFor="edit-nombre">Nombre del Producto</label>
                <input type="text" id="edit-nombre" name="nombre" value={editingProduct.nombre} onChange={handleEditingProductChange} required />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="edit-bodega">Stock Bodega</label>
                  <input type="number" id="edit-bodega" name="bodega" value={editingProduct.bodega} onChange={handleEditingProductChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-cocina">Stock Cocina</label>
                  <input type="number" id="edit-cocina" name="cocina" value={editingProduct.cocina} onChange={handleEditingProductChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-stock_min">Stock Mínimo</label>
                  <input type="number" id="edit-stock_min" name="stock_min" value={editingProduct.stock_min} onChange={handleEditingProductChange} />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-stock_max">Stock Máximo</label>
                  <input type="number" id="edit-stock_max" name="stock_max" value={editingProduct.stock_max} onChange={handleEditingProductChange} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="modal-button-cancel" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                <button type="submit" className="modal-button-confirm" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Confirmar Borrado */}
      {isDeleteModalOpen && deletingProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title modal-title-danger">Confirmar Eliminación</h2>
            <p className="modal-message">
              ¿Estás seguro de que quieres eliminar el producto <strong>{deletingProduct.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button type="button" className="modal-button-cancel" onClick={() => setIsDeleteModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="modal-button-danger" onClick={confirmDelete} disabled={isSubmitting}>
                {isSubmitting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Descargar */}
      {isDownloadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Descargar Inventario</h2>
            <p className="modal-message">Elige el formato en el que deseas descargar la tabla.</p>
            <div className="download-options">
              <button className="download-option-btn pdf" onClick={handleDownloadPDF}>
                <FaFilePdf /> Descargar PDF
              </button>
              <button className="download-option-btn image" onClick={handleDownloadImage}>
                <FaFileImage /> Descargar Imagen
              </button>
            </div>
            <button className="modal-button-cancel" style={{marginTop: '20px'}} onClick={() => setIsDownloadModalOpen(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal para Confirmar Guardado */}
      {isSaveModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Guardar Reporte de Inventario</h2>
            <div className="save-report-body">
              <label htmlFor="reportDate">Selecciona la fecha del reporte:</label>
              <input
                type="date"
                id="reportDate"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]} // No permite fechas futuras
              />
              {saveError && <p className="error-message">{saveError}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="modal-button-cancel" onClick={() => setIsSaveModalOpen(false)}>Cancelar</button>
              <button type="button" className="modal-button-confirm" onClick={handleConfirmSave} disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar Reporte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla oculta para la captura de imagen y datos de PDF */}
      <div style={{ position: 'absolute', left: '-9999px', top: 'auto' }}>
        <div id="capture-container" style={{ padding: '20px', backgroundColor: 'white', width: '1200px' }}>
          <h2 style={{ textAlign: 'center', color: '#333' }}>Reporte de Inventario - Al Aire Rooftop</h2>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginTop: '-10px' }}>
            Descargado por: {profile?.nombre} {profile?.apellido}
          </p>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginTop: '-10px', marginBottom: '25px' }}>
            Fecha de descarga: {new Date().toLocaleString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Bodega</th>
                <th>Ingreso</th>
                <th>Salida</th>
                <th>Cocina</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {products.filter(p => p.nombre.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                <tr key={`capture-${item.id}`}>
                  <td>{item.nombre}</td>
                  <td>{item.bodega || 0}</td>
                  <td>{item.ingreso || 0}</td>
                  <td>{item.salida || 0}</td>
                  <td>{item.cocina || 0}</td>
                  <td>{(item.bodega || 0) + (item.cocina || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}