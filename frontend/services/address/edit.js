let addressPromise = [];
export const getAddressPromise = () => {
    let resolver;
    let rejecter;
    const nextPromise = new Promise((resolve, reject) => {
        resolver = resolve;
        rejecter = reject;
    });
    addressPromise.push({ resolver, rejecter });
    return nextPromise;
};
export const resolveAddress = (address) => {
    const allAddress = [...addressPromise];
    addressPromise = [];
    console.info('用户保存了一个地址', address);
    allAddress.forEach(({ resolver }) => resolver(address));
};
export const rejectAddress = () => {
    const allAddress = [...addressPromise];
    addressPromise = [];
    allAddress.forEach(({ rejecter }) => rejecter(new Error('cancel')));
};
