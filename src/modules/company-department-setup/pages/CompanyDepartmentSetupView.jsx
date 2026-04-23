"use client";

import { useCompanyDepartmentSetup } from "../hooks/useCompanyDepartmentSetup";
import { CompanyDeptHeader } from "../components/CompanyDeptHeader";
import { CompanyTable } from "../components/CompanyTable";
import { DepartmentPanel } from "../components/DepartmentPanel";
import { CompanyDeptDialog } from "../components/CompanyDeptDialog";

export default function CompanyDepartmentSetupView({ companies, departments, initialSelectedCompanyId }) {
  const h = useCompanyDepartmentSetup({ companies, departments, initialSelectedCompanyId });

  return (
    <main className="container py-4">
      <CompanyDeptHeader
        hasPendingChanges={h.hasPendingChanges} pendingSummary={h.pendingSummary}
        isSaving={h.isSaving} isMutatingAction={h.isMutatingAction}
        isSelectedCompanyPendingDeactivation={h.isSelectedCompanyPendingDeactivation}
        selectedCompany={h.selectedCompany}
        handleSaveBatch={h.handleSaveBatch} handleCancelBatch={h.handleCancelBatch}
        openAddCompanyDialog={h.openAddCompanyDialog} openAddDepartmentDialog={h.openAddDepartmentDialog}
      />

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-6">
          <CompanyTable
            decoratedCompanies={h.decoratedCompanies} selectedCompany={h.selectedCompany}
            isSaving={h.isSaving} isMutatingAction={h.isMutatingAction}
            pendingDeactivatedCompanyIds={h.pendingDeactivatedCompanyIds}
            handleCompanyRowClick={h.handleCompanyRowClick}
            editingCompanyId={h.editingCompanyId}
            onStartEditing={h.startEditingCompany}
            onStopEditing={h.stopEditingCompany}
            onInlineEdit={h.handleInlineEditCompany}
            openToggleCompanyDialog={h.openToggleCompanyDialog}
            openDeactivateCompanyDialog={h.openDeactivateCompanyDialog}
          />
        </div>
        <div className="col-12 col-xl-6">
          <DepartmentPanel
            selectedCompany={h.selectedCompany} decoratedDepartments={h.decoratedDepartments}
            isSaving={h.isSaving} isMutatingAction={h.isMutatingAction}
            pendingDeactivatedDepartmentIds={h.pendingDeactivatedDepartmentIds}
            editingDeptId={h.editingDeptId}
            onStartEditing={h.startEditingDept}
            onStopEditing={h.stopEditingDept}
            onInlineEdit={h.handleInlineEditDepartment}
            openToggleDepartmentDialog={h.openToggleDepartmentDialog}
            openDeactivateDepartmentDialog={h.openDeactivateDepartmentDialog}
          />
        </div>
      </div>

      <CompanyDeptDialog
        dialog={h.dialog} companyDraft={h.companyDraft} departmentDraft={h.departmentDraft}
        isMutatingAction={h.isMutatingAction}
        setCompanyDraft={h.setCompanyDraft} setDepartmentDraft={h.setDepartmentDraft} closeDialog={h.closeDialog}
        submitAddCompany={h.submitAddCompany} submitEditCompany={h.submitEditCompany}
        submitToggleCompany={h.submitToggleCompany} submitDeactivateCompany={h.submitDeactivateCompany}
        submitAddDepartment={h.submitAddDepartment} submitEditDepartment={h.submitEditDepartment}
        submitToggleDepartment={h.submitToggleDepartment} submitDeactivateDepartment={h.submitDeactivateDepartment}
      />
    </main>
  );
}
