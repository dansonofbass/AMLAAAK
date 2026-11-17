'use client';
import { useState, useRef } from 'react';
import { GripHorizontal, MoveUpRight } from 'lucide-react';
export function Widget({ title, label, className = '', children, movable = false }: { title: string; label?: string; className?: string; children: React.ReactNode; movable?: boolean }) {
  const [offset, setOffset] = useState({ x:0, y:0 });
  const drag = useRef<{ x: number; y: number; initialX: number; initialY: number } | null>(null);
  return <section className={`chart-card ${movable?'floating-widget':''} ${className}`} style={movable?{ transform:`translate(${offset.x}px, ${offset.y}px)` }:undefined}>
    <header className="chart-card-header"><div><h3>{title}</h3>{label&&<span>{label}</span>}</div>
      {movable?<button className="widget-drag" aria-label={`Move ${title} widget`} title="Drag to move · Arrow keys to nudge · Home to reset" onPointerDown={e=>{ e.currentTarget.setPointerCapture(e.pointerId); drag.current={x:e.clientX,y:e.clientY,initialX:offset.x,initialY:offset.y}; }} onPointerMove={e=>{if(drag.current)setOffset({x:Math.max(-80,Math.min(350,drag.current.initialX+e.clientX-drag.current.x)),y:Math.max(-30,Math.min(200,drag.current.initialY+e.clientY-drag.current.y))});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();setOffset(e.key==='Home'?{x:0,y:0}:{x:offset.x+(e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:0),y:offset.y+(e.key==='ArrowDown'?10:e.key==='ArrowUp'?-10:0)});}}}><GripHorizontal size={15}/></button>:<MoveUpRight size={13} className="card-corner-icon"/>}
    </header><div className="chart-card-body">{children}</div>
  </section>;
}
