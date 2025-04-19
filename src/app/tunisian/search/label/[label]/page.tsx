"use client";
import React, { useEffect } from 'react';

export default function Page() {
  useEffect(() => {
    // Get the full URL, then extract the path and query without modifying it
    const fullUrl = window.location.href;

    // Extract the portion after '/tunisian' to match your requirement
    const currentPath = fullUrl.split('/tunisian')[1]; // Get the path after '/tunisian'
    console.log(currentPath)
    // Send the exact path (as it is) to the backend
    // fetch('/api/tunisian/get-episodes', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ link: currentPath }), // Send the path as the 'link' to the backend
    // })
    //   .then((response) => response.json())
    //   .then((data) => {
    //     console.log('Data received:', data); // Process the response here
    //   })
    //   .catch((error) => {
    //     console.error('Error fetching data:', error); // Error handling
    //   });
  }, []); // Only run once when the component is mounted

  return (
    <div>page</div>
  );
}
