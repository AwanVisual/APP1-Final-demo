import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  DollarSign,
  Package,
  FileText,
  Printer
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/pdfGenerator';
import * as XLSX from 'xlsx';

const Reports = () => {
  const { userRole } = useAuth();
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState('sales');

  const { data: salesData } = useQuery({
    queryKey: ['sales-report', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            *,
            products (name, sku)
          )
        `)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });
      
      return data || [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*');
      const settingsMap = data?.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, string>) || {};
      return settingsMap;
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-report'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('stock_quantity', { ascending: true });
      
      return data || [];
    },
  });

  const calculateSalesStats = () => {
    if (!salesData) return { totalSales: 0, totalRevenue: 0, avgOrderValue: 0 };
    
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
    const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    
    return { totalSales, totalRevenue, avgOrderValue };
  };

  const stats = calculateSalesStats();

  const handlePrintInvoice = async (sale: any) => {
    // Convert sale_items to cart format
    const cart = sale.sale_items.map((item: any) => ({
      product: {
        id: item.product_id,
        name: item.products?.name || 'Unknown Product',
        price: item.unit_price
      },
      quantity: item.quantity,
      customDiscount: item.discount || 0
    }));

    const receiptConfig = {
      showAmount: true,
      showDppFaktur: false,
      showDiscount: false,
      showPpn11: false,
      discountPercentage: 0,
    };

    // Extract sales name from notes
    const salesName = sale.notes?.includes('Sales:') 
      ? sale.notes.split('Sales:')[1].split('|')[0].trim()
      : 'Unknown';

    await printInvoicePDF(
      sale,
      cart,
      settings || {},
      receiptConfig,
      salesName
    );
  };

  const handleDownloadInvoice = async (sale: any) => {
    // Convert sale_items to cart format
    const cart = sale.sale_items.map((item: any) => ({
      product: {
        id: item.product_id,
        name: item.products?.name || 'Unknown Product',
        price: item.unit_price
      },
      quantity: item.quantity,
      customDiscount: item.discount || 0
    }));

    const receiptConfig = {
      showAmount: true,
      showDppFaktur: false,
      showDiscount: false,
      showPpn11: false,
      discountPercentage: 0,
    };

    // Extract sales name from notes
    const salesName = sale.notes?.includes('Sales:') 
      ? sale.notes.split('Sales:')[1].split('|')[0].trim()
      : 'Unknown';

    await downloadInvoicePDF(
      sale,
      cart,
      settings || {},
      receiptConfig,
      salesName
    );
  };

  const exportToExcel = () => {
    if (reportType === 'sales' && salesData) {
      const exportData = salesData.map(sale => ({
        'Sale Number': sale.sale_number,
        'Date': formatDate(sale.created_at),
        'Customer': sale.customer_name || 'Walk-in',
        'Payment Method': sale.payment_method,
        'Subtotal': sale.subtotal,
        'Tax': sale.tax_amount,
        'Total': sale.total_amount,
        'Payment Received': sale.payment_received,
        'Change': sale.change_amount,
        'Status': sale.invoice_status || 'lunas',
        'Notes': sale.notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
      XLSX.writeFile(wb, `Sales_Report_${dateFrom}_to_${dateTo}.xlsx`);
    } else if (reportType === 'products' && productsData) {
      const exportData = productsData.map(product => ({
        'SKU': product.sku,
        'Name': product.name,
        'Category': product.categories?.name || 'No Category',
        'Price': product.price,
        'Cost': product.cost,
        'Stock': product.stock_quantity,
        'Min Stock': product.min_stock_level,
        'Status': product.is_active ? 'Active' : 'Inactive',
        'Created': formatDate(product.created_at)
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products Report');
      XLSX.writeFile(wb, `Products_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    const variants: Record<string, any> = {
      cash: 'default',
      card: 'secondary',
      transfer: 'outline',
      credit: 'destructive'
    };
    return variants[method] || 'default';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      lunas: 'default',
      dp: 'secondary',
      belum_bayar: 'destructive'
    };
    return variants[status] || 'default';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-gray-600">View sales performance and generate reports</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales Report</SelectItem>
                  <SelectItem value="products">Products Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {reportType === 'sales' && (
              <>
                <div>
                  <Label htmlFor="dateFrom">From Date</Label>
                  <Input
                    id="dateFrom"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="dateTo">To Date</Label>
                  <Input
                    id="dateTo"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </>
            )}
            
            <div className="flex items-end">
              <Button onClick={exportToExcel} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Statistics */}
      {reportType === 'sales' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSales}</div>
              <p className="text-xs text-muted-foreground">
                {dateFrom === dateTo ? 'Today' : `${dateFrom} to ${dateTo}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                Gross sales revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.avgOrderValue)}</div>
              <p className="text-xs text-muted-foreground">
                Average per transaction
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sales Report Table */}
      {reportType === 'sales' && (
        <Card>
          <CardHeader>
            <CardTitle>Sales Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData?.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.sale_number}</TableCell>
                    <TableCell>{formatDate(sale.created_at)}</TableCell>
                    <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                    <TableCell>
                      <Badge variant={getPaymentMethodBadge(sale.payment_method)}>
                        {sale.payment_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(Number(sale.total_amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadge(sale.invoice_status || 'lunas')}>
                        {sale.invoice_status || 'lunas'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePrintInvoice(sale)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadInvoice(sale)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Products Report Table */}
      {reportType === 'products' && (
        <Card>
          <CardHeader>
            <CardTitle>Products Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsData?.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.sku}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{product.categories?.name || 'No Category'}</TableCell>
                    <TableCell>{formatCurrency(Number(product.price))}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Package className="h-4 w-4" />
                        <span>{product.stock_quantity}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.stock_quantity <= product.min_stock_level
                            ? "destructive"
                            : "default"
                        }
                      >
                        {product.stock_quantity <= product.min_stock_level
                          ? "Low Stock"
                          : "In Stock"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;