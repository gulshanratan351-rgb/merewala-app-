import React from 'react';
import Sidebar from '@/components/Sidebar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#030305]">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
