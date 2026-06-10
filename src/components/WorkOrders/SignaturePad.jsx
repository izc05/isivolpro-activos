import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const SignaturePad = forwardRef(function SignaturePad(_, ref) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const parent = canvas.parentElement;
      const ratio = window.devicePixelRatio || 1;
      const width = parent.clientWidth || 640;
      const height = 220;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111827';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      setEmpty(true);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setEmpty(true);
    },
    isEmpty() {
      return empty;
    },
    async toFile(fileName = 'firma-cliente.png') {
      if (empty) throw new Error('La firma esta vacia.');
      const canvas = canvasRef.current;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      if (!blob) throw new Error('No se pudo preparar la firma.');
      return new File([blob], fileName, { type: 'image/png' });
    }
  }), [empty]);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function start(event) {
    event.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPoint(event);
  }

  function move(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(event);
    const last = lastPointRef.current;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    setEmpty(false);
  }

  function end(event) {
    event.preventDefault();
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ border: '1px solid var(--border-color, #d1d5db)', borderRadius: 12, background: '#fff', touchAction: 'none', width: '100%' }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <p className="muted">Firma con el dedo o raton dentro del recuadro.</p>
    </div>
  );
});

export default SignaturePad;
