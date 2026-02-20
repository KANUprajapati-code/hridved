import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import DoctorBooking from '../models/DoctorBooking.js';

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    try {
        const totalOrders = await Order.countDocuments({});
        const totalUsers = await User.countDocuments({});
        const totalProducts = await Product.countDocuments({});
        const totalConsultations = await DoctorBooking.countDocuments({});

        // Calculate Total Revenue
        const paidOrders = await Order.find({ isPaid: true });
        const totalRevenue = paidOrders.reduce((acc, order) => acc + order.totalPrice, 0);

        // Sales Data for Charts (Last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const salesStats = await Order.aggregate([
            {
                $match: {
                    isPaid: true,
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$createdAt" },
                        year: { $year: "$createdAt" }
                    },
                    revenue: { $sum: "$totalPrice" },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // Map salesStats to a predictable 6-month array
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyData = [];
        for (let i = 0; i < 6; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() - (5 - i));
            const monthIndex = date.getMonth();
            const year = date.getFullYear();

            const stat = salesStats.find(s => s._id.month === (monthIndex + 1) && s._id.year === year);
            monthlyData.push({
                month: months[monthIndex],
                revenue: stat ? stat.revenue : 0,
                orders: stat ? stat.orders : 0
            });
        }

        // Low Stock Products (Less than 10 in stock)
        const lowStockProducts = await Product.find({ countInStock: { $lt: 20 } }).limit(5);

        // Recent Orders
        const recentOrders = await Order.find({})
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'name');

        res.json({
            stats: {
                totalRevenue,
                activeOrders: totalOrders, // Simplified for now
                totalCustomers: totalUsers,
                totalConsultations
            },
            monthlyData,
            lowStockProducts: lowStockProducts.map(p => ({
                name: p.name,
                sku: `SKU-${p._id.toString().substring(0, 6).toUpperCase()}`,
                left: p.countInStock
            })),
            recentOrders: recentOrders.map(o => ({
                id: `#${o._id.toString().substring(0, 8).toUpperCase()}`,
                name: o.user?.name || 'Guest',
                product: o.orderItems[0]?.name + (o.orderItems.length > 1 ? ` + ${o.orderItems.length - 1} more` : ''),
                date: new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                amount: `₹${o.totalPrice.toLocaleString('en-IN')}`,
                status: o.isDelivered ? 'Delivered' : (o.isPaid ? 'Paid' : 'Pending'),
                isPaid: o.isPaid,
                isDelivered: o.isDelivered
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

export { getDashboardStats };
