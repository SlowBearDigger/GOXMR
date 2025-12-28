import React, { forwardRef } from 'react';
import { CustomField } from '../../types';

interface InvoicePreviewProps {
    businessName: string;
    invoiceNumber: string;
    date: string;
    customFields: CustomField[];
    amount: string;
    currency: string;
    qrRef: React.RefObject<HTMLDivElement>;
    logo: string | null;
    notes: string;
}

export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>((props, ref) => {
    const { businessName, invoiceNumber, date, customFields, amount, currency, qrRef, logo, notes } = props;

    return (
        <div className="w-full flex justify-center p-2">
            <div
                ref={ref}
                className="w-full max-w-sm border-2 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative flex flex-col font-mono overflow-hidden"
                style={{
                    minHeight: '550px',
                    backgroundColor: '#FFFFFF',
                    borderColor: '#000000',
                    color: '#000000'
                }}
            >
                {/* Header stripe */}
                <div className="h-4 w-full border-b-2" style={{ backgroundColor: '#F26822', borderColor: '#000000' }}></div>

                <div className="p-6 flex-grow flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                            <h1 className="text-xl font-black uppercase tracking-tighter leading-none break-words">
                                {businessName || 'UNIDENTIFIED ENTITY'}
                            </h1>
                            <p className="text-[10px] mt-1 font-bold inline-block px-1" style={{ backgroundColor: '#000000', color: '#FFFFFF' }}>INVOICE_TRANSMISSION_{invoiceNumber || '0001'}</p>
                        </div>
                        {logo && (
                            <div className="ml-2 border-2 p-1" style={{ backgroundColor: '#FFFFFF', borderColor: '#000000' }}>
                                <img src={logo} alt="Logo" className="w-12 h-12 object-contain" crossOrigin="anonymous" />
                            </div>
                        )}
                    </div>

                    {/* Details */}
                    <div className="flex justify-between text-[10px] mb-6 border-b-2 pb-2 uppercase font-bold" style={{ borderColor: '#000000' }}>
                        <div>
                            <p className="opacity-50">Timestamp</p>
                            <p>{date || new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="opacity-50">Sequence</p>
                            <p>#{invoiceNumber || '0001'}</p>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="space-y-4 mb-8 flex-grow">
                        <div className="flex justify-between text-[8px] font-black uppercase border-b pb-1" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                            <span>Description</span>
                            <span>Value</span>
                        </div>
                        {customFields.length > 0 ? customFields.map((field) => (
                            <div key={field.id} className="flex justify-between items-center text-xs border-b pb-1" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                                <span className="font-bold">{field.label}</span>
                                <span className="font-black">{field.value}</span>
                            </div>
                        )) : (
                            <div className="text-center text-[10px] italic py-4 opacity-30 uppercase font-bold">
                                (Empty Manifest)
                            </div>
                        )}

                        {amount && (
                            <div className="flex justify-between items-center pt-4 border-t-4 mt-4" style={{ borderColor: '#000000' }}>
                                <span className="text-sm font-black uppercase">Grand Total</span>
                                <div className="text-right">
                                    <span className="text-xl font-black px-2 py-1 border-2 inline-block" style={{ backgroundColor: '#F26822', borderColor: '#000000', color: '#000000' }}>
                                        {amount} <span className="text-[10px]">{currency}</span>
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer / QR */}
                    <div className="flex flex-col items-center justify-center mt-auto pt-4 border-t-2 border-dotted" style={{ borderColor: '#000000' }}>
                        <p className="text-[8px] mb-2 font-black uppercase tracking-[0.2em] opacity-50">Scan. Transmit. Sovereignty.</p>

                        <div className="p-2 border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]" style={{ backgroundColor: '#FFFFFF', borderColor: '#000000' }}>
                            <div ref={qrRef} className="flex items-center justify-center min-w-[140px] min-h-[140px]"></div>
                        </div>

                        {notes && (
                            <div className="mt-4 p-2 border w-full text-center" style={{ backgroundColor: '#f3f4f6', borderColor: 'rgba(0,0,0,0.1)' }}>
                                <p className="text-[9px] font-bold italic leading-tight">
                                    "{notes}"
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="p-2 text-center overflow-hidden" style={{ backgroundColor: '#000000', color: '#FFFFFF' }}>
                    <p className="text-[8px] font-black tracking-widest uppercase whitespace-nowrap animate-pulse">
                        GOXMR SECURE PROTOCOL // ENCRYPTED NODE CONNECTION // NO MIDDLEMEN
                    </p>
                </div>
            </div>
        </div>
    );
});

InvoicePreview.displayName = 'InvoicePreview';
