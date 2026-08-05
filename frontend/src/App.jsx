import { useEffect, lazy, Suspense } from "react"
import { Routes, Route, Navigate, Outlet } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { analyticsAPI } from "./api"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { ThemeProvider } from "./context/ThemeContext"
import { CartProvider } from "./context/CartContext"
import Navbar  from "./components/common/Navbar"
import Footer  from "./components/common/Footer"
import Loading from "./components/common/Loading"
const Home = lazy(() => import("./pages/Home"))
const Products = lazy(() => import("./pages/Products"))
const ProductDetail = lazy(() => import("./pages/ProductDetail"))
const Cart = lazy(() => import("./pages/Cart"))
const Checkout = lazy(() => import("./pages/Checkout"))
const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })))
const Register = lazy(() => import("./pages/Login").then(m => ({ default: m.Register })))
const Profile = lazy(() => import("./pages/Profile"))
const OrderHistory = lazy(() => import("./pages/OrderHistory").then(m => ({ default: m.OrderHistory })))
const OrderDetail = lazy(() => import("./pages/OrderDetail"))
const Wishlist = lazy(() => import("./pages/Wishlist"))
const Info = lazy(() => import("./pages/Info"))
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"))
const Dashboard = lazy(() => import("./pages/admin/Dashboard"))
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"))
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"))
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"))
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics").then(m => ({ default: m.AdminAnalytics })))
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"))
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"))

function PrivateRoute() { const{user,loading}=useAuth(); if(loading) return <Loading fullscreen/>; return user?<Outlet/>:<Navigate to="/login" replace/> }
function AdminRoute() { const{user,loading,isAdmin}=useAuth(); if(loading) return <Loading fullscreen/>; if(!user) return <Navigate to="/login" replace/>; if(!isAdmin) return <Navigate to="/" replace/>; return <Outlet/> }
function GuestRoute() { const{user,loading}=useAuth(); if(loading) return <Loading fullscreen/>; return !user?<Outlet/>:<Navigate to="/" replace/> }
function UserLayout() { return <div className="min-h-screen flex flex-col"><Navbar/><main className="flex-1"><Outlet/></main><Footer/></div> }

export default function App() {
  useEffect(() => {
    if (!sessionStorage.getItem("lyvo_visited")) {
      sessionStorage.setItem("lyvo_visited", "1")
      analyticsAPI.recordVisit().catch(() => {})
    }
  }, [])
  return (
    <ThemeProvider>
    <AuthProvider>
      <CartProvider>
        <Toaster position="top-right" toastOptions={{ duration:3000, style:{background:"#16161f",color:"#fff",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"12px",fontSize:"14px"}, success:{iconTheme:{primary:"#FFFFFF",secondary:"#0A0A0A"}}, error:{iconTheme:{primary:"#FF3A1A",secondary:"#fff"}} }}/>
        <Suspense fallback={<Loading fullscreen />}>
          <Routes>
            <Route element={<UserLayout/>}>
              <Route path="/" element={<Home/>}/>
              <Route path="/products" element={<Products/>}/>
              <Route path="/products/:id" element={<ProductDetail/>}/>
              <Route path="/cart" element={<Cart/>}/>
              <Route path="/info/:section" element={<Info/>}/>
              <Route element={<GuestRoute/>}>
                <Route path="/login" element={<Login/>}/>
                <Route path="/register" element={<Register/>}/>
              </Route>
              <Route element={<PrivateRoute/>}>
                <Route path="/checkout" element={<Checkout/>}/>
                <Route path="/profile" element={<Profile/>}/>
                <Route path="/orders" element={<OrderHistory/>}/>
                <Route path="/orders/:id" element={<OrderDetail/>}/>
                <Route path="/wishlist" element={<Wishlist/>}/>
              </Route>
            </Route>
            <Route element={<AdminRoute/>}>
              <Route path="/admin" element={<AdminLayout/>}>
                <Route index element={<Dashboard/>}/>
                <Route path="products" element={<AdminProducts/>}/>
                <Route path="orders" element={<AdminOrders/>}/>
                <Route path="users" element={<AdminUsers/>}/>
                <Route path="analytics" element={<AdminAnalytics/>}/>
                <Route path="categories" element={<AdminCategories/>}/>
                <Route path="coupons" element={<AdminCoupons/>}/>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Routes>
        </Suspense>
      </CartProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}
