import React from "react";
import CircularProgress from '@mui/material/CircularProgress';

function LoadingScreen() {
    return <div className="loading">
    <CircularProgress />
    </div>;
}

export default LoadingScreen;