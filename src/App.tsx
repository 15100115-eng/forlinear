import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppData } from './store'
import { makeT } from './i18n'
import type { Order } from './types'
import { fmtMonth, monthKey, uid } from './calc'
import { Icons } from './components/ui'
import { Dashboard } from './components/Dashboard'
import { OrdersPage } from './components/Orders'
import { OrderForm } from './components/OrderForm'
import { Analytics } from './components/Analytics'
import { IncomePage } from './components/Income'
import { SuppliesPage } from './components/Supplies'
import { SettingsPage } from './components/Settings'
import { OpexPage } from './components/Opex'
import { InvoiceDoc, InvoiceForm, InvoicesPage, blankInvoice, invoiceFromOrder } from './components/Invoice'
import type { Invoice } from './types'

type Page = 'dashboard' | 'orders' | 'analytics' | 'income' | 'opex' | 'supplies' | 'invoices' | 'settings'

export default function App() {
  const { data, update, setData } = useAppData()
  const t = useMemo(() => makeT(data.settings.lang), [data.settings.lang])
  const lang = data.settings.lang
  const [page, setPage] = useState<Page>('dashboard')
  const [monthSel, setMonth] = useState<string>('all')
  const [form, setForm] = useState<{ open: boolean; order?: Order }>({ open: false })
  const [more, setMore] = useState(false)
  const [invoice, setInvoice] = useState<Invoice | null>(null)

  useEffect(() => {
    const th = data.settings.theme
    if (th === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', th)
    document.documentElement.lang = lang
  }, [data.settings.theme, lang])

  const months = useMemo(() => [...new Set(data.orders.map((o) => monthKey(o.date)))].sort().reverse(), [data.orders])
  const month = monthSel !== 'all' && !months.includes(monthSel) ? 'all' : monthSel

  const clients = useMemo(() => [...new Set(data.orders.map((o) => o.client))].sort(), [data.orders])

  const saveOrder = useCallback(
    (o: Order) => {
      update((d) => ({ ...d, orders: d.orders.some((x) => x.id === o.id) ? d.orders.map((x) => (x.id === o.id ? o : x)) : [...d.orders, o] }))
      setForm({ open: false })
    },
    [update],
  )
  const deleteOrder = (o: Order) => update((d) => ({ ...d, orders: d.orders.filter((x) => x.id !== o.id) }))
  const duplicateOrder = (o: Order) =>
    setForm({ open: true, order: { ...structuredClone(o), id: uid(), createdAt: new Date().toISOString(), expenses: o.expenses.map((l) => ({ ...l, id: uid() })) } })
  const closeForm = useCallback(() => setForm({ open: false }), [])

  const nav: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: Icons.dashboard },
    { id: 'orders', label: t('nav_orders'), icon: Icons.orders },
    { id: 'analytics', label: t('nav_analytics'), icon: Icons.analytics },
    { id: 'income', label: t('nav_income'), icon: Icons.income },
    { id: 'opex', label: t('nav_opex'), icon: Icons.ads },
    { id: 'supplies', label: t('nav_supplies'), icon: Icons.supplies },
    { id: 'invoices', label: t('nav_invoices'), icon: Icons.invoice },
    { id: 'settings', label: t('nav_settings'), icon: Icons.settings },
  ]
  const showMonth = page === 'dashboard' || page === 'orders' || page === 'analytics'
  const primaryNav = nav.slice(0, 4)
  const moreNav = nav.slice(4)
  const go = (p: Page) => {
    setPage(p)
    setMore(false)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          NEXT MOVE
          <small>{lang === 'ka' ? 'ფინანსური დაფა' : 'Finance dashboard'}</small>
        </div>
        {nav.map((n) => (
          <button key={n.id} className={`nav-btn ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
            {n.icon} {n.label}
          </button>
        ))}
        <div className="spacer" />
        <button className="btn primary" onClick={() => setForm({ open: true })}>
          {t('addOrder')}
        </button>
      </aside>
      <main className="main">
        <div className="topbar">
          <h1>{nav.find((n) => n.id === page)?.label}</h1>
          <div className="right">
            {showMonth && (
              <select className="inline-select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label={t('month')}>
                <option value="all">{t('allMonths')}</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {fmtMonth(m, lang, true)}
                  </option>
                ))}
              </select>
            )}
            <button className="btn primary topbar-add" onClick={() => setForm({ open: true })}>
              {t('addOrder')}
            </button>
          </div>
        </div>

        {page === 'dashboard' && <Dashboard data={data} t={t} lang={lang} month={month} onEdit={(o) => setForm({ open: true, order: o })} goOrders={() => setPage('orders')} />}
        {page === 'orders' && <OrdersPage data={data} t={t} lang={lang} month={month} onEdit={(o) => setForm({ open: true, order: o })} onDelete={deleteOrder} onDuplicate={duplicateOrder} onInvoice={(o) => setInvoice((data.invoices ?? []).find((i) => i.orderId === o.id) ?? invoiceFromOrder(data, o))} />}
        {page === 'analytics' && <Analytics data={data} t={t} lang={lang} month={month} />}
        {page === 'income' && <IncomePage data={data} t={t} update={update} />}
        {page === 'opex' && <OpexPage data={data} t={t} lang={lang} update={update} />}
        {page === 'invoices' && <InvoicesPage data={data} t={t} onOpen={(inv) => setInvoice(inv)} onNew={() => setInvoice(blankInvoice(data))} />}
        {page === 'supplies' && <SuppliesPage data={data} t={t} update={update} />}
        {page === 'settings' && <SettingsPage data={data} t={t} update={update} setData={setData} />}
      </main>

      <nav className="bottom-nav" aria-label="navigation">
        {primaryNav.map((n) => (
          <button key={n.id} className={`tab ${page === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
            {n.icon}
            <span>{n.label}</span>
          </button>
        ))}
        <button className={`tab ${moreNav.some((n) => n.id === page) || more ? 'active' : ''}`} onClick={() => setMore((m) => !m)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
          <span>{t('more')}</span>
        </button>
      </nav>
      {more && (
        <div className="sheet-bg" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {moreNav.map((n) => (
              <button key={n.id} className={`nav-btn ${page === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
                {n.icon} {n.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="fab" onClick={() => setForm({ open: true })} aria-label={t('addOrder')}>+</button>

      {invoice && (
        <InvoiceForm
          key={invoice.id}
          initial={invoice}
          data={data}
          t={t}
          onClose={() => setInvoice(null)}
          onSave={(inv) => {
            update((d) => {
              const list = d.invoices ?? []
              return { ...d, invoices: list.some((x) => x.id === inv.id) ? list.map((x) => (x.id === inv.id ? inv : x)) : [...list, inv] }
            })
            setInvoice(inv)
          }}
        />
      )}
      {invoice && (
        <div className="print-only">
          <InvoiceDoc inv={invoice} data={data} t={t} />
        </div>
      )}
      {form.open && <OrderForm key={form.order?.id ?? 'new'} initial={form.order} settings={data.settings} t={t} onSave={saveOrder} onClose={closeForm} clients={clients} />}
    </div>
  )
}
