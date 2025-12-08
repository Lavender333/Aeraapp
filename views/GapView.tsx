
import React, { useState } from 'react';
import { ViewState } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ArrowLeft, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { t } from '../services/translations';

export const GapView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [activeTab, setActiveTab] = useState<'GRANTS' | 'ADVANCES' | 'PAYMENTS'>('GRANTS');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-lg text-slate-900">{t('gap.title')}</h1>
            <p className="text-xs text-slate-500">{t('gap.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-slate-200">
        {['GRANTS', 'ADVANCES', 'PAYMENTS'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 py-4 text-sm font-semibold transition-colors relative ${
              activeTab === tab ? 'text-brand-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl flex items-start gap-3">
           <DollarSign className="text-brand-600 mt-1" size={20} />
           <div>
             <h3 className="font-semibold text-brand-800">{t('gap.funding_avail')}</h3>
             <p className="text-sm text-brand-600 mt-1">
               {t('gap.funding_desc')}
             </p>
           </div>
        </div>

        {activeTab === 'GRANTS' && (
          <div className="space-y-4">
             <Card>
               <div className="flex justify-between items-start mb-2">
                 <h3 className="font-bold">{t('gap.grant.housing')}</h3>
                 <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">{t('gap.status.open')}</span>
               </div>
               <p className="text-sm text-slate-600 mb-4">{t('gap.grant.housing_desc')}</p>
               <Button size="sm" fullWidth>{t('btn.apply')}</Button>
             </Card>
             <Card>
               <div className="flex justify-between items-start mb-2">
                 <h3 className="font-bold">{t('gap.grant.business')}</h3>
                 <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">{t('gap.status.pending')}</span>
               </div>
               <p className="text-sm text-slate-600 mb-4">{t('gap.grant.business_desc')}</p>
               <Button size="sm" variant="outline" fullWidth disabled>Application Under Review</Button>
             </Card>
          </div>
        )}

        {activeTab === 'ADVANCES' && (
          <div className="space-y-4">
            <div className="text-center py-8 text-slate-500">
               <Clock size={48} className="mx-auto mb-3 opacity-20" />
               <p>{t('gap.no_advances')}</p>
               <Button variant="ghost" className="mt-2 text-brand-600">{t('gap.req_advance')}</Button>
            </div>
          </div>
        )}

        {activeTab === 'PAYMENTS' && (
          <div className="space-y-2">
             <div className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-green-50 rounded-full text-green-600"><CheckCircle size={16} /></div>
                   <div>
                     <div className="font-medium text-slate-900">Relief Stipend #4092</div>
                     <div className="text-xs text-slate-500">Aug 24, 2024</div>
                   </div>
                </div>
                <div className="font-bold text-slate-900">$250.00</div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
