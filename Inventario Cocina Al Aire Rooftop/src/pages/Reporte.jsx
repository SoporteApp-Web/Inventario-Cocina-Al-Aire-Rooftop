import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// 🔒 FUNCIÓN SEGURA PARA FECHA LOCAL (YYYY-MM-DD)
const formatLocalDate = (date) => {
  return `${date.getFullYear()}-${
    String(date.getMonth() + 1).padStart(2, '0')
  }-${
    String(date.getDate()).padStart(2, '0')
  }`;
};

export default function Reporte() {
  const [alertProducts, setAlertProducts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // Estados para el modal y los reportes
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);
  const [reportMode, setReportMode] = useState('daily');
  const [modalError, setModalError] = useState('');
  const [highlightedDates, setHighlightedDates] = useState([]);

  // 🔁 CARGA INICIAL
  useEffect(() => {
    const fetchAlertProducts = async () => {
      setAlertsLoading(true);
      const { data } = await supabase
        .from('products')
        .select('nombre, bodega, stock_min');

      if (data) {
        setAlertProducts(data.filter(p => p.bodega < p.stock_min));
      }
      setAlertsLoading(false);
    };

    // 🟢 IMPORTANTE: resaltamos días con SALIDAS reales
    const fetchHighlightedDates = async () => {
      const { data } = await supabase
        .from('product_movements')
        .select('report_date')
        .like('movement_type', 'salida%');

      if (data) {
        const uniqueDates = [...new Set(data.map(d => d.report_date))];
        setHighlightedDates(
          uniqueDates.map(d => new Date(`${d}T00:00:00`))
        );
      }
    };

    fetchAlertProducts();
    fetchHighlightedDates();
  }, []);

  // 📊 GENERAR REPORTE DIARIO
  const generateReportData = async ({ start, end }) => {
    try {
      // Formateamos las fechas para la consulta
      const startDateString = formatLocalDate(start);
      const endDateString = formatLocalDate(end);

      const { data, error } = await supabase
        .from('product_movements')
        .select('product_id, quantity')
        .like('movement_type', 'salida%')
        // Buscamos en el rango de fechas
        .gte('report_date', startDateString)
        .lte('report_date', endDateString);

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No se encontraron salidas para la fecha seleccionada.');
        return { labels: [], values: [] };
      }

      // 🔢 Agrupar por producto
      const grouped = {};
      data.forEach(({ product_id, quantity }) => {
        grouped[product_id] = (grouped[product_id] || 0) + quantity;
      });

      // 📦 Obtener nombres
      const productIds = Object.keys(grouped);
      const { data: products } = await supabase
        .from('products')
        .select('id, nombre')
        .in('id', productIds);

      const nameMap = {};
      products?.forEach(p => {
        nameMap[p.id] = p.nombre;
      });

      return {
        labels: productIds.map(id => nameMap[id] || 'Producto'),
        values: productIds.map(id => grouped[id])
      };

    } catch (err) {
      console.error('Error generando reporte:', err);
      return { labels: [], values: [] };
    }
  };

  // 📈 MOSTRAR REPORTE
  const displayReport = async (range) => {
    setIsGenerating(true);
    const { labels, values } = await generateReportData(range);

    setChartData({
      labels,
      datasets: [{
        label: 'Total de Salidas',
        data: values,
        backgroundColor: 'rgba(255, 99, 132, 0.6)'
      }]
    });

    setIsGenerating(false);
  };

  const openModal = (mode) => {
    setReportMode(mode);
    setModalError(''); // Limpiar errores al abrir
    setIsModalOpen(true);
  };

  const handleDateChange = (dates) => {
    if (reportMode === 'weekly') {
      const [start, end] = dates;
      setStartDate(start);
      setEndDate(end);
    } else {
      setStartDate(dates);
    }
  };

  const handleGenerateReport = () => {
    setModalError('');
    let start, end;

    switch (reportMode) {
      case 'daily':
        start = new Date(startDate);
        end = new Date(startDate);
        break;
      case 'weekly':
        if (!startDate || !endDate) {
          setModalError('Debes seleccionar un rango de fechas.');
          return;
        }
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays > 8) {
          setModalError('El rango no puede ser mayor a 8 días.');
          return;
        }
        start = startDate;
        end = endDate;
        break;
      case 'monthly':
        start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        end = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        break;
      default:
        return;
    }

    displayReport({ start, end });
    setIsModalOpen(false);
  };

  if (alertsLoading) return <p>Cargando reportes...</p>;

  return (
    <div className="report-container">
      <h1>Reportes</h1>

      {/* 🔔 ALERTAS DE STOCK */}
      <div className="stock-alert-section">
        <h4>Alerta de Stock</h4>
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Stock</th>
              <th>Stock Mínimo</th>
            </tr>
          </thead>
          <tbody>
            {alertProducts.length > 0 ? alertProducts.map(p => (
              <tr key={p.nombre}>
                <td>{p.nombre}</td>
                <td>{p.bodega}</td>
                <td>{p.stock_min}</td>
              </tr>
            )) : (
              <tr><td colSpan="3">Sin alertas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 📊 REPORTE */}
      <div className="chart-section">
        <h4>Reporte de Salidas</h4>
        <div className="chart-actions">
          <button onClick={() => openModal('daily')} className="action-btn">Diario</button>
          <button onClick={() => openModal('weekly')} className="action-btn">Semanal</button>
          <button onClick={() => openModal('monthly')} className="action-btn">Mensual</button>
        </div>

        <div className="chart-container">
          {isGenerating
            ? <p>Generando gráfico...</p>
            : chartData.labels.length > 0
              ? <Bar data={chartData} />
              : <p>Seleccione una fecha para generar el reporte.</p>}
        </div>
      </div>

      {/* 📅 MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Seleccionar Rango</h2>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <DatePicker
                inline
                selected={startDate}
                onChange={handleDateChange}
                startDate={startDate}
                endDate={endDate}
                selectsRange={reportMode === 'weekly'}
                showMonthYearPicker={reportMode === 'monthly'}
                dateFormat={reportMode === 'monthly' ? 'MM/yyyy' : 'dd/MM/yyyy'}
                maxDate={new Date()}
                highlightDates={highlightedDates}
              />
            </div>
            {modalError && <p className="error-message">{modalError}</p>}
            <div className="modal-actions">
              <button className="modal-button-cancel" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="modal-button-confirm" onClick={handleGenerateReport}>Generar Reporte</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
