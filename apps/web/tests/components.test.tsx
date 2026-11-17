import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { it, expect } from 'vitest';
import { Button } from '../src/components/ui/button';
import { ErrorState, EmptyState } from '../src/components/status';
it('renders a real disabled button',()=>{const html=renderToStaticMarkup(<Button disabled>Predict</Button>);expect(html).toContain('disabled');expect(html).toContain('Predict');});
it('renders errors as accessible alerts',()=>{const html=renderToStaticMarkup(<ErrorState message="Backend offline" retry={()=>{}}/>);expect(html).toContain('role="alert"');expect(html).toContain('Backend offline');expect(html).toContain('Try again');});
it('provides a reset action for empty selections',()=>{const html=renderToStaticMarkup(<EmptyState reset={()=>{}}/>);expect(html).toContain('No matching sales');expect(html).toContain('Reset filters');});
