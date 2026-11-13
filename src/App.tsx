import { useState } from 'react';
import { AnalyticsView } from './components/AnalyticsView';
import { DebtorsView } from './components/DebtorsView';
import { InventoryView } from './components/InventoryView';
import { LedgerView } from './components/LedgerView';
import { ParserWorkspace } from './components/ParserWorkspace';
import { SecurityView, type UserRole } from './components/SecurityView';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { usePosStore } from './hooks/usePosStore';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('parser');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('ATTENDANT');

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
    <div className="min-h-screen w-full flex bg-[#F8FAFC] text-[#0F172A] overflow-x-hidden">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        userRole={userRole}
        metrics={metrics}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        <TopBar
          activeTab={activeTab}
          isOffline={isOffline}
          onToggleOffline={() => setSimulatedOffline(!simulatedOffline)}
          unsyncedCount={metrics.unsyncedCount}
          onSyncQueue={syncOfflineQueue}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 w-full max-w-md md:max-w-3xl lg:max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-24 lg:pb-8 overflow-x-hidden">
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

          {activeTab === 'analytics' && (
            <AnalyticsView
              skus={skus}
              debtors={debtors}
              ledger={ledger}
              isOffline={isOffline}
              onNavigateToDebtors={() => setActiveTab('debtors')}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              skus={skus}
              userRole={userRole}
              onAdjustStock={adjustSkuStock}
              onAddSku={addSku}
            />
          )}

          {activeTab === 'debtors' && (
            <DebtorsView
              debtors={debtors}
              ledger={ledger}
              onRecordPayment={commitTransaction}
            />
          )}

          {activeTab === 'ledger' && (
            <LedgerView ledger={ledger} onResetDemo={resetDemoData} />
          )}

          {activeTab === 'security' && (
            <SecurityView
              userRole={userRole}
              onUnlockOwner={() => setUserRole('OWNER')}
              onLockToAttendant={() => setUserRole('ATTENDANT')}
              onOpenPosTerminal={() => setActiveTab('parser')}
              skus={skus}
              ledger={ledger}
            />
          )}
        </main>
      </div>
    </div>
  );
}
