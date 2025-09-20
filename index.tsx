import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// --- TYPES ---
type CardData = { id: string; appId: string; title: string; };
type AppId = 'gastos' | 'analiticas' | 'horarios' | 'inventario' | 'empleados' | 'miHorario' | 'misTareas' | 'misFinanzas' | 'checkIn' | 'estado' | 'apiLogs' | 'sincronizacion' | 'menu';
type Empleado = { id: string; nombre: string; puesto: string; rfc: string; nss: string; fechaIngreso: string; sueldoBruto: number; periodicidadPago: 'Semanal' | 'Quincenal'; usuario: string; pass: string; horaEntrada: string; horaSalida: string; horasPendientes: number; clockInTime: number | null; tasks: {id: number, text: string, completed: boolean}[]; performanceRating: 'green' | 'yellow' | 'red'; loan: { active: boolean, amount: number, weeklyPayment: number }; loanRequest: { pending: boolean, amount: number, message: string }, capturedPhoto?: string };
type Proveedor = { id: number; nombre: string; contacto: string; telefono: string; categoria: string };
type User = { id: string, type: 'admin' | 'empleado' | 'developer' };
type Schedule = { [day: string]: { [empleadoId: string]: string } };
type ApiLog = { timestamp: string, request: any, response: any, error?: boolean };
type SyncHistoryItem = { id: string; date: string; task: string; status: 'completado' | 'fallido'; itemCount: number; userId: string; details: string; };

// --- FINANCIAL TYPES ---
type HistorialCosto = { fecha: string; costo: number; gastoId: string; };
type InventarioItem = {
  id: string;
  nombre: string;
  stock: number;
  um: string; // Unidad de Medida (pza, kg, lt)
  categoria: string;
  proveedorId: number;
  costoUnitario: number; // El costo más reciente por unidad de medida
  historialCostos: HistorialCosto[]; // Para rastrear fluctuaciones de precio
};
type ItemGasto = { id: string; descripcion: string; cantidad: number; precio: number; inventarioId?: string; };
type Gasto = { id: string; fecha: string; proveedor: string; items: ItemGasto[]; total: number; };
type Ingrediente = { inventarioId: string; cantidad: number; };
type Platillo = { id: string; nombre: string; precioVenta: number; ingredientes: Ingrediente[]; };


type EmpleadoUpdateAction = 
    | { type: 'ADD', payload: Omit<Empleado, 'id'> } 
    | { type: 'UPDATE', payload: Empleado } 
    | { type: 'DELETE', payload: { id: string } } 
    | { type: 'TOGGLE_TASK', payload: { empleadoId: string, taskId: number } } 
    | { type: 'ADD_TASK', payload: { empleadoId: string, taskText: string } } 
    | { type: 'APPROVE_LOAN', payload: { empleadoId: string } } 
    | { type: 'REJECT_LOAN', payload: { empleadoId: string } }
    | { type: 'CLOCK_IN', payload: { empleadoId: string, timestamp: number, photo: string } }
    | { type: 'CLOCK_OUT', payload: { empleadoId: string, timestamp: number } };

// --- DUMMY DATA ---
const initialEmpleados: Empleado[] = [ { id: 'juan', nombre: "Juan Pérez García", puesto: "Bartender", rfc: "PEGA900101ABC", nss: "12345678901", fechaIngreso: "2024-03-15", sueldoBruto: 2000, periodicidadPago: 'Semanal', usuario: 'juan.perez', pass: '4004', horaEntrada: '14:00', horaSalida: '22:00', horasPendientes: 0, clockInTime: null, tasks: [{id: 1, text: 'Limpiar barra principal', completed: false}], performanceRating: 'green', loan: { active: false, amount: 0, weeklyPayment: 0 }, loanRequest: { pending: false, amount: 0, message: '' } }, { id: 'maria', nombre: "María López Hernández", puesto: "Mesera", rfc: "LOHM920510XYZ", nss: "10987654321", fechaIngreso: "2023-11-01", sueldoBruto: 3750, periodicidadPago: 'Quincenal', usuario: 'maria.lopez', pass: 'kraken2', horaEntrada: '13:00', horaSalida: '21:00', horasPendientes: 45, clockInTime: null, tasks: [], performanceRating: 'yellow', loan: { active: true, amount: 500, weeklyPayment: 50 }, loanRequest: { pending: false, amount: 0, message: '' } }, { id: 'carlos', nombre: "Carlos Sánchez Ruiz", puesto: "Cocinero", rfc: "SARC880320DEF", nss: "23456789012", fechaIngreso: "2024-01-20", sueldoBruto: 2200, periodicidadPago: 'Semanal', usuario: 'carlos.sanchez', pass: 'kraken3', horaEntrada: '12:00', horaSalida: '20:00', horasPendientes: 0, clockInTime: null, tasks: [], performanceRating: 'green', loan: { active: false, amount: 0, weeklyPayment: 0 }, loanRequest: { pending: true, amount: 1000, message: 'Adelanto para una emergencia familiar.' } } ];
const initialProveedores: Proveedor[] = [ { id: 1, nombre: 'Distribuidora de Vinos del Nazas', contacto: 'Juan Torres', telefono: '871-555-0101', categoria: 'Bebidas' }, { id: 2, nombre: 'Carnes Finas La Laguna', contacto: 'Sofía Martínez', telefono: '871-555-0102', categoria: 'Alimentos' } ];
const initialInventario: InventarioItem[] = [
    { id: 'cerveza-victoria', nombre: 'Cerveza Victoria', stock: 100, categoria: 'Bebidas', proveedorId: 1, um: 'pza', costoUnitario: 18.50, historialCostos: [] },
    { id: 'limon', nombre: 'Limón', stock: 20, categoria: 'Alimentos', proveedorId: 2, um: 'kg', costoUnitario: 35.00, historialCostos: [] },
    { id: 'rib-eye', nombre: 'Rib Eye', stock: 8, categoria: 'Alimentos', proveedorId: 2, um: 'kg', costoUnitario: 450.00, historialCostos: [] },
    { id: 'aguacate', nombre: 'Aguacate', stock: 15, categoria: 'Alimentos', proveedorId: 2, um: 'kg', costoUnitario: 85.00, historialCostos: [] }
];
const initialPlatillos: Platillo[] = [
    { id: 'taco-carne', nombre: 'Taco de Rib Eye', precioVenta: 85, ingredientes: [{ inventarioId: 'rib-eye', cantidad: 0.150 /* 150g */ }] },
    { id: 'guacamole', nombre: 'Guacamole', precioVenta: 120, ingredientes: [{ inventarioId: 'aguacate', cantidad: 0.300 }, { inventarioId: 'limon', cantidad: 0.050 }] }
];
const initialSyncHistory: SyncHistoryItem[] = [
    { id: 'sync-1', date: '2024-07-20T10:00:00Z', task: 'Corte de Caja', status: 'completado', itemCount: 152, userId: 'admin', details: 'Se importaron 152 registros de ventas.' },
    { id: 'sync-2', date: '2024-07-19T11:30:00Z', task: 'Corte de Caja', status: 'fallido', itemCount: 0, userId: 'admin', details: 'Error de formato en el archivo CSV en la línea 42.' },
];



// --- HELPER FUNCTIONS & COMPONENTS ---
const formatCurrency = (value: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
const Loader = ({text = "Procesando..."}) => <div className="loader-container"><div className="loader"></div><span>{text}</span></div>;
const CameraErrorIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><line x1="1" y1="1" x2="23" y2="23"/><circle cx="12" cy="13" r="3"/></svg>;
const Modal = ({ show, onClose, title, children }) => {
    if (!show) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button onClick={onClose} className="modal-close-button">&times;</button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
};

// --- ICONS ---
const EmpleadosIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const GastosIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
const AnaliticasIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20V14"/></svg>;
const HorariosIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const InventarioIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const TareasIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
const FinanzasIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const CheckInIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /><path d="m9 12 2 2 4-4" /></svg>;
const StateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>;
const LogIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17l-4-4 4-4"/><path d="M8 13h11"/></svg>;
const AppsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const AiIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/><path d="M2.5 16.5A2.5 2.5 0 0 1 0 14V3.5A2.5 2.5 0 0 1 2.5 1H14a2.5 2.5 0 0 1 2.5 2.5V6"/><path d="M21.5 8.5A2.5 2.5 0 0 1 24 11v9.5a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 9 20.5V18"/></svg>;
const SincronizacionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>;
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z" /><path d="M7 15.5c-1 0-1.5-1-1.5-2.5 0-2.5 1.33-4.5 3-4.5 1.67 0 3 2 3 4.5 0 1.5-.5 2.5-1.5 2.5" /><path d="M17 15.5c-1 0-1.5-1-1.5-2.5 0-2.5 1.33-4.5 3-4.5 1.67 0 3 2 3 4.5 0 1.5-.5 2.5-1.5 2.5" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const ChecklistIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v18h-6M10 21h-6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6M5 9l2 2 4-4"/></svg>;
const SuccessIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const ErrorIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

// --- CHECK-IN COMPONENT ---
const CheckInContent = ({ empleado, onUpdate }: { empleado: Empleado, onUpdate: (action: EmpleadoUpdateAction) => void }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [cameraError, setCameraError] = useState<string | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        let stream: MediaStream | null = null;
        const initCamera = async () => {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setCameraError("Tu dispositivo no es compatible con la cámara.");
                return;
            }
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error al acceder a la cámara:", err);
                setCameraError("Se requiere acceso a la cámara para registrar la entrada. Revisa los permisos en tu navegador.");
            }
        };

        if (!empleado.clockInTime) {
            initCamera();
        }

        return () => {
            clearInterval(timer);
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [empleado.clockInTime]);

    const handleClockIn = () => {
        if (!videoRef.current || !canvasRef.current || cameraError) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.scale(-1, 1); // Flip horizontally
            context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        }
        const photo = canvas.toDataURL('image/jpeg');
        
        onUpdate({ 
            type: 'CLOCK_IN', 
            payload: { empleadoId: empleado.id, timestamp: Date.now(), photo } 
        });
    };

    const handleClockOut = () => {
        onUpdate({ 
            type: 'CLOCK_OUT', 
            payload: { empleadoId: empleado.id, timestamp: Date.now() } 
        });
    };

    if (!empleado.clockInTime) { // VISTA DE ENTRADA
        return (
            <div style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem', margin: '20px 0' }}>{currentTime.toLocaleTimeString()}</h1>
                <div className="camera-container">
                    <video ref={videoRef} className="camera-feed" autoPlay playsInline muted></video>
                    {cameraError && (
                        <div className="camera-error">
                            <CameraErrorIcon />
                            <p>{cameraError}</p>
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                <button onClick={handleClockIn} disabled={!!cameraError} className="action-button success" style={{width: '100%', padding: '20px', fontSize: '1.5rem'}}>
                    REGISTRAR ENTRADA
                </button>
            </div>
        );
    } else { // VISTA DE SALIDA
        const clockInDate = new Date(empleado.clockInTime);
        const elapsedMs = currentTime.getTime() - clockInDate.getTime();
        const elapsedHours = Math.floor(elapsedMs / 3600000);
        const elapsedMinutes = Math.floor((elapsedMs % 3600000) / 60000);

        return (
            <div style={{ textAlign: 'center' }}>
                <h2 className="section-title">Turno en Progreso</h2>
                <div className="kpi-card" style={{margin: '20px 0'}}>
                    <p className="kpi-label">Entrada Registrada a las:</p>
                    <p className="kpi-value">{clockInDate.toLocaleTimeString()}</p>
                </div>
                 <div className="kpi-card" style={{margin: '20px 0'}}>
                    <p className="kpi-label">Tiempo Transcurrido:</p>
                    <p className="kpi-value">{`${elapsedHours}h ${elapsedMinutes}m`}</p>
                </div>
                {empleado.capturedPhoto && <img src={empleado.capturedPhoto} alt="Foto de entrada" style={{width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', margin: '20px auto'}} />}
                <button onClick={handleClockOut} className="action-button danger" style={{width: '100%', padding: '20px', fontSize: '1.5rem'}}>
                    FINALIZAR TURNO
                </button>
            </div>
        );
    }
};

// --- INVENTORY APP ---
const InventarioContent = ({ inventario, onUpdate }) => {
    const totalValue = useMemo(() => inventario.reduce((total, item) => total + (item.stock * item.costoUnitario), 0), [inventario]);
    return (
        <div>
            <div className="kpi-card" style={{ marginBottom: 'var(--space-l)'}}>
                <p className="kpi-label">Valor Total del Inventario</p>
                <p className="kpi-value">{formatCurrency(totalValue)}</p>
            </div>
            <h2 className="section-title">Items en Inventario</h2>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Stock</th>
                        <th>Costo Unitario</th>
                        <th>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    {inventario.map(item => (
                        <tr key={item.id}>
                            <td>{item.nombre}</td>
                            <td>{item.stock} {item.um}</td>
                            <td>{formatCurrency(item.costoUnitario)}</td>
                            <td>{formatCurrency(item.stock * item.costoUnitario)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


// --- GASTOS APP ---
const GastosContent = ({ inventario, onGastoAdd, onInventarioUpdate }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedItems, setExtractedItems] = useState<ItemGasto[]>([]);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [currentItemToLink, setCurrentItemToLink] = useState<ItemGasto | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            handleOcr(file);
        }
    };

    const handleOcr = async (file: File) => {
        setLoading(true);
        setError(null);
        setExtractedItems([]);
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('prompt', "Analiza la imagen de este ticket. Extrae cada línea de producto como un objeto JSON con 'descripcion', 'cantidad' y 'precio'. Devuelve un array de estos objetos. No incluyas impuestos, subtotales o totales.");

        try {
            const response = await fetch('/api/ocr', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en el servidor al procesar el ticket.');
            }

            const parsedJson = await response.json();
            setExtractedItems(parsedJson.map(item => ({ ...item, id: `gasto-item-${Date.now()}-${Math.random()}` })));
        } catch (e) {
            console.error(e);
            setError(e.message || "No se pudo procesar la imagen. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const openLinkModal = (item: ItemGasto) => {
        setCurrentItemToLink(item);
        setShowLinkModal(true);
        setSearchTerm('');
    };

    const handleLinkItem = (inventarioItem: InventarioItem) => {
        if (!currentItemToLink) return;
        setExtractedItems(prev => prev.map(item =>
            item.id === currentItemToLink.id ? { ...item, inventarioId: inventarioItem.id } : item
        ));
        setShowLinkModal(false);
        setCurrentItemToLink(null);
    };

    const handleSaveGasto = () => {
        const newGastoId = `gasto-${Date.now()}`;
        const total = extractedItems.reduce((sum, item) => sum + item.precio, 0);
        const newGasto: Gasto = {
            id: newGastoId,
            fecha: new Date().toISOString(),
            proveedor: "Proveedor General",
            items: extractedItems,
            total,
        };
        onGastoAdd(newGasto);

        extractedItems.forEach(item => {
            if (item.inventarioId) {
                const newCost = item.precio / item.cantidad;
                onInventarioUpdate({
                    type: 'UPDATE_COST',
                    payload: {
                        itemId: item.inventarioId,
                        newCost,
                        gastoId: newGastoId
                    }
                });
            }
        });

        // Reset state
        setImageFile(null);
        setExtractedItems([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const filteredInventario = useMemo(() => inventario.filter(item => item.nombre.toLowerCase().includes(searchTerm.toLowerCase())), [inventario, searchTerm]);

    return (
        <div>
            <h2 className="section-title">Registrar Nuevo Gasto</h2>
            {!imageFile && !loading && (
                <div className="file-upload-area">
                    <AiIcon />
                    <p>Sube una foto de tu ticket o factura</p>
                    <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} ref={fileInputRef} />
                    <button className="action-button" onClick={() => fileInputRef.current?.click()}>Seleccionar Archivo</button>
                </div>
            )}
            {loading && <Loader text="Analizando ticket con IA..." />}
            {error && <p style={{ color: 'var(--priority-high)' }}>{error}</p>}
            
            {extractedItems.length > 0 && (
                <div>
                    <h3 className="section-title" style={{ marginTop: 'var(--space-l)' }}>Items Extraídos</h3>
                    <table className="data-table linking-table">
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th>Cant.</th>
                                <th>Precio</th>
                                <th>Inventario Vinculado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {extractedItems.map(item => {
                                const linkedItem = inventario.find(i => i.id === item.inventarioId);
                                return (
                                    <tr key={item.id}>
                                        <td>{item.descripcion}</td>
                                        <td>{item.cantidad}</td>
                                        <td>{formatCurrency(item.precio)}</td>
                                        <td>
                                            {linkedItem ? (
                                                <span className="linked-item">{linkedItem.nombre}</span>
                                            ) : (
                                                <button className="action-button-secondary" onClick={() => openLinkModal(item)}>Vincular</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <button className="action-button success" style={{ width: '100%', marginTop: 'var(--space-l)' }} onClick={handleSaveGasto}>
                        Guardar Gasto
                    </button>
                </div>
            )}

            <Modal show={showLinkModal} onClose={() => setShowLinkModal(false)} title={`Vincular "${currentItemToLink?.descripcion}"`}>
                <input
                    type="text"
                    placeholder="Buscar en inventario..."
                    className="modal-search-input"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <ul className="modal-link-list">
                    {filteredInventario.map(item => (
                        <li key={item.id} onClick={() => handleLinkItem(item)}>
                            {item.nombre} <span className="item-details">({item.stock} {item.um})</span>
                        </li>
                    ))}
                </ul>
            </Modal>
        </div>
    );
};

// --- MENU ENGINEERING APP ---
const MenuContent = ({ platillos, inventario, onUpdate }) => {
    const calculatePlatilloMetrics = useCallback((platillo: Platillo) => {
        const costoPlatillo = platillo.ingredientes.reduce((total, ing) => {
            const inventarioItem = inventario.find(item => item.id === ing.inventarioId);
            if (!inventarioItem) return total;
            return total + (ing.cantidad * inventarioItem.costoUnitario);
        }, 0);

        const utilidadBruta = platillo.precioVenta - costoPlatillo;
        const margenUtilidad = platillo.precioVenta > 0 ? (utilidadBruta / platillo.precioVenta) * 100 : 0;

        return { costoPlatillo, utilidadBruta, margenUtilidad };
    }, [inventario]);

    return (
        <div>
            <h2 className="section-title">Ingeniería de Menú</h2>
            <div className="platillo-grid">
                {platillos.map(platillo => {
                    const { costoPlatillo, utilidadBruta, margenUtilidad } = calculatePlatilloMetrics(platillo);
                    let marginClass = '';
                    if (margenUtilidad > 60) marginClass = 'profit-high';
                    else if (margenUtilidad > 30) marginClass = 'profit-medium';
                    else marginClass = 'profit-low';

                    return (
                        <div key={platillo.id} className="platillo-card">
                            <div className="platillo-header">
                                <h3>{platillo.nombre}</h3>
                                <p className="platillo-price">{formatCurrency(platillo.precioVenta)}</p>
                            </div>
                            <div className="platillo-metrics">
                                <div>
                                    <span className="metric-label">Costo</span>
                                    <span className="metric-value">{formatCurrency(costoPlatillo)}</span>
                                </div>
                                <div>
                                    <span className="metric-label">Utilidad</span>
                                    <span className="metric-value">{formatCurrency(utilidadBruta)}</span>
                                </div>
                                <div>
                                    <span className="metric-label">Margen</span>
                                    <span className={`metric-value ${marginClass}`}>{margenUtilidad.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


// --- NYX OS CORE COMPONENTS ---

const Card = ({ data, onBack, onClose, children, animationState }) => {
    return (
        <div className={`card ${animationState}`}>
            <div className="card-header">
                <div className="card-controls">
                    <button className="card-control close" onClick={() => onClose(data.id)}></button>
                    <button className="card-control back" onClick={() => onBack(data.id)}></button>
                    <button className="card-control split"></button>
                </div>
                <div className="card-title">{data.title}</div>
            </div>
            <div className="card-content">
                {children}
            </div>
        </div>
    );
};

const Dock = ({ onAppOpen, userApps }) => {
    const APP_ICONS: Record<AppId, JSX.Element> = {
        empleados: <EmpleadosIcon />,
        gastos: <GastosIcon />,
        analiticas: <AnaliticasIcon />,
        horarios: <HorariosIcon />,
        inventario: <InventarioIcon />,
        miHorario: <HorariosIcon />,
        misTareas: <TareasIcon />,
        misFinanzas: <FinanzasIcon />,
        checkIn: <CheckInIcon />,
        estado: <StateIcon />,
        apiLogs: <LogIcon />,
        sincronizacion: <SincronizacionIcon/>,
        menu: <MenuIcon />
    };
    
    return (
        <div className="dock">
            <div className="dock-item" onClick={() => onAppOpen('apps')}>
                <AppsIcon />
            </div>
            {userApps.map(appId => (
                 <div key={appId} className="dock-item" onClick={() => onAppOpen(appId)}>
                    {APP_ICONS[appId]}
                </div>
            ))}
        </div>
    );
};

// --- APP STATE ---

const useNyxState = () => {
    const [cards, setCards] = useState<CardData[]>([]);
    const [animationStates, setAnimationStates] = useState({});
    const [empleados, setEmpleados] = useState<Empleado[]>(initialEmpleados);
    const [proveedores, setProveedores] = useState<Proveedor[]>(initialProveedores);
    const [inventario, setInventario] = useState<InventarioItem[]>(initialInventario);
    const [gastos, setGastos] = useState<Gasto[]>([]);
    const [platillos, setPlatillos] = useState<Platillo[]>(initialPlatillos);
    const [syncHistory, setSyncHistory] = useState<SyncHistoryItem[]>(initialSyncHistory);
    
    const [currentUser, setCurrentUser] = useState<User>({ id: 'admin', type: 'admin' });

    const handleEmpleadoUpdate = useCallback((action: EmpleadoUpdateAction) => {
        setEmpleados(prev => {
            switch (action.type) {
                case 'CLOCK_IN':
                    return prev.map(e => 
                        e.id === action.payload.empleadoId 
                        ? { ...e, clockInTime: action.payload.timestamp, capturedPhoto: action.payload.photo } 
                        : e
                    );
                case 'CLOCK_OUT':
                    return prev.map(e => {
                        if (e.id === action.payload.empleadoId && e.clockInTime) {
                            const durationMs = action.payload.timestamp - e.clockInTime;
                            const durationHours = durationMs / (1000 * 60 * 60);
                            const newHorasPendientes = (e.horasPendientes || 0) + durationHours;
                            return { ...e, clockInTime: null, horasPendientes: newHorasPendientes };
                        }
                        return e;
                    });
                case 'ADD':
                case 'UPDATE':
                case 'DELETE':
                case 'TOGGLE_TASK':
                case 'ADD_TASK':
                case 'APPROVE_LOAN':
                case 'REJECT_LOAN':
                    console.warn(`Action type ${action.type} is not yet implemented.`);
                    return prev;
                default:
                    return prev;
            }
        });
    }, []);
    
    const handleInventarioUpdate = useCallback((action) => {
        setInventario(prev => {
            switch(action.type) {
                case 'UPDATE_COST': {
                    const { itemId, newCost, gastoId } = action.payload;
                    return prev.map(item => {
                        if (item.id === itemId) {
                            const newHistoryEntry: HistorialCosto = {
                                fecha: new Date().toISOString(),
                                costo: newCost,
                                gastoId,
                            };
                            return {
                                ...item,
                                costoUnitario: newCost,
                                historialCostos: [...item.historialCostos, newHistoryEntry]
                            };
                        }
                        return item;
                    });
                }
                default:
                    return prev;
            }
        });
    }, []);
    
    const handleGastoAdd = useCallback((gasto: Gasto) => {
        setGastos(prev => [...prev, gasto]);
    }, []);

    const handleSyncAdd = useCallback((item: Omit<SyncHistoryItem, 'id' | 'date' | 'userId'>) => {
        setSyncHistory(prev => [{
            id: `sync-${Date.now()}`,
            date: new Date().toISOString(),
            userId: currentUser.id,
            ...item
        }, ...prev]);
    }, [currentUser.id]);

    const openApp = useCallback((appId: AppId) => {
        const newCardId = `${appId}-${Date.now()}`;
        const newCard: CardData = { id: newCardId, appId, title: appId.charAt(0).toUpperCase() + appId.slice(1) };
        setCards(prev => [...prev, newCard]);
        setAnimationStates(prev => ({ ...prev, [newCardId]: 'entering' }));
        setTimeout(() => setAnimationStates(prev => ({ ...prev, [newCardId]: '' })), 500);
    }, []);

    const closeCard = useCallback((cardId: string) => {
        setAnimationStates(prev => ({ ...prev, [cardId]: 'exiting' }));
        setTimeout(() => {
            setCards(prev => prev.filter(c => c.id !== cardId));
            setAnimationStates(prev => {
                const newStates = { ...prev };
                delete newStates[cardId];
                return newStates;
            });
        }, 500);
    }, []);

    const backCard = useCallback((cardId: string) => {
        const topCard = cards[cards.length - 1];
        if (topCard && topCard.id === cardId) {
            closeCard(cardId);
        }
    }, [cards, closeCard]);
    
    const loggedInEmpleado = useMemo(() => empleados.find(e => e.id === currentUser.id), [empleados, currentUser]);

    return {
        cards,
        animationStates,
        empleados,
        proveedores,
        inventario,
        gastos,
        platillos,
        syncHistory,
        currentUser,
        loggedInEmpleado,
        actions: {
            openApp,
            closeCard,
            backCard,
            handleSyncAdd,
            handleEmpleadoUpdate,
            handleInventarioUpdate,
            handleGastoAdd
        }
    };
};


// --- MAIN APP ---
const NyxApp = () => {
    const { cards, animationStates, empleados, proveedores, inventario, gastos, platillos, syncHistory, currentUser, loggedInEmpleado, actions } = useNyxState();
    const [mode, setMode] = useState<'wallet' | 'desktop'>('wallet');

    useEffect(() => {
        const handleResize = () => setMode(window.innerWidth > 1024 ? 'desktop' : 'wallet');
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const ADMIN_APPS: AppId[] = ['empleados', 'analiticas', 'horarios', 'inventario', 'gastos', 'menu'];
    const EMPLOYEE_APPS: AppId[] = ['miHorario', 'misTareas', 'misFinanzas', 'checkIn'];
    const DEV_APPS: AppId[] = ['estado', 'apiLogs', 'sincronizacion'];
    
    const userApps = useMemo(() => {
        switch(currentUser.type) {
            case 'admin': return ADMIN_APPS;
            case 'empleado': return EMPLOYEE_APPS;
            case 'developer': return DEV_APPS;
            default: return [];
        }
    }, [currentUser.type]);

    const appContentMap: Record<AppId, JSX.Element> = {
        empleados: <div>Admin Empleados Content</div>,
        gastos: <GastosContent inventario={inventario} onGastoAdd={actions.handleGastoAdd} onInventarioUpdate={actions.handleInventarioUpdate} />,
        analiticas: <div>Admin Analiticas Content</div>,
        horarios: <div>Admin Horarios Content</div>,
        inventario: <InventarioContent inventario={inventario} onUpdate={actions.handleInventarioUpdate} />,
        menu: <MenuContent platillos={platillos} inventario={inventario} onUpdate={() => {}} />,
        miHorario: <div>Empleado Mi Horario Content</div>,
        misTareas: <div>Empleado Mis Tareas Content</div>,
        misFinanzas: <div>Empleado Mis Finanzas Content</div>,
        checkIn: loggedInEmpleado ? <CheckInContent empleado={loggedInEmpleado} onUpdate={actions.handleEmpleadoUpdate} /> : <div>Cargando empleado...</div>,
        estado: <div>Dev Estado Content</div>,
        apiLogs: <div>Dev API Logs Content</div>,
        sincronizacion: <SincronizacionContent history={syncHistory} onSyncAdd={actions.handleSyncAdd} onDataUpdate={() => { console.log("Data update triggered"); }} />,
    };
    
    return (
        <div className={`nyx-app ${cards.length > 0 ? 'cards-active' : ''} ${mode}-mode`}>
             <div className="card-container">
                {cards.map(card => (
                    <Card 
                        key={card.id} 
                        data={card} 
                        onBack={actions.backCard} 
                        onClose={actions.closeCard} 
                        animationState={animationStates[card.id] || ''}
                    >
                        {appContentMap[card.appId] || <div>App not found</div>}
                    </Card>
                ))}
            </div>
            <Dock onAppOpen={actions.openApp} userApps={userApps} />
        </div>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<NyxApp />);