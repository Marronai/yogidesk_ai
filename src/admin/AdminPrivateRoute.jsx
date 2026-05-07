import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const AdminPrivateRoute = () => {
  const token = localStorage.getItem('admin_token');
  const role = localStorage.getItem('admin_role');

  return token && role === 'admin' ? <Outlet /> : <Navigate to="/admin/login" replace />;
};

export default AdminPrivateRoute;
