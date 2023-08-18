export const removeFromArray = <T>(arr: T[], item: T) => {
    const index = arr.indexOf(item);
    if (index !== -1) {
        const result = arr.splice(index, 1);
        return result[0];
    }
    return undefined;
}

export const removeFromArrayByIndex = <T>(arr: T[], index: number) => {
    if (index !== -1) {
        const result = arr.splice(index, 1);
        return result[0];
    }
    return undefined;
}
