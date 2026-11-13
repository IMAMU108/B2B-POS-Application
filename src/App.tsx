import { useState } from 'react';
import { DebtorsView } from './components/DebtorsView';
import { InventoryView } from './components/InventoryView';
import { LedgerView } from './components/LedgerView';
import { ParserWorkspace } from './components/ParserWorkspace';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { usePosStore } from './hooks/usePosStore';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('parser');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    skus,
    debtors,
    ledger,
    isOffline,
    simulatedOffline,
    setSimulatedOffline,
    metrics,
    commitTransaction,
    addSku,
    adjustSkuStock,
    syncOfflineQueue,
    resetDemoData,
  } = usePosStore();

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        metrics={metrics}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeTab={activeTab}
          isOffline={isOffline}
          onToggleOffline={() => setSimulatedOffline(!simulatedOffline)}
          unsyncedCount={metrics.unsyncedCount}
          onSyncQueue={syncOfflineQueue}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'parser' && (
            <ParserWorkspace
              skus={skus}
              debtors={debtors}
              ledger={ledger}
              isOffline={isOffline}
              metrics={metrics}
              onCommit={commitTransaction}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              skus={skus}
              onAdjustStock={adjustSkuStock}
              onAddSku={addSku}
            />
          )}

          {activeTab === 'debtors' && (
            <DebtorsView debtors={debtors} onRecordPayment={commitTransaction} />
          )}

          {activeTab === 'ledger' && (
            <LedgerView ledger={ledger} onResetDemo={resetDemoData} />
          )}
        </main>
      </div>
    </div>
  );
}
