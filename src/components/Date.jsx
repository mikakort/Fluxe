const today = new Date();
/*
const dd = String(today.getDate()).padStart(2, '0');
const mm = String(today.getMonth() + 1).padStart(2, '1'); //January is 0!
*/
const yyyy = today.getFullYear();

// const fullDay = mm + '/' + dd + '/' + yyyy;

export default yyyy;